import { randomUUID } from "crypto";

import { NextResponse } from "next/server";

import { listBuyouts } from "@/lib/buyouts";
import { getGmailReadiness, searchGmailMessages } from "@/lib/gmail";
import { hasDatabaseUrl, prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Cron: sync recent sent/received emails for all active buyouts into StoredEmail.
 * Runs every 30 minutes. Only fetches the last 10 messages per direction per buyout,
 * skips any already stored (by gmailMessageId).
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!hasDatabaseUrl() || !getGmailReadiness().ready) {
    return NextResponse.json({ error: "DB or Gmail not configured." }, { status: 400 });
  }

  // Ensure table exists
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "StoredEmail" (
      "id" TEXT PRIMARY KEY,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "buyoutId" TEXT NOT NULL,
      "gmailMessageId" TEXT NOT NULL UNIQUE,
      "direction" TEXT NOT NULL,
      "fromAddress" TEXT NOT NULL,
      "toAddress" TEXT NOT NULL,
      "subject" TEXT,
      "snippet" TEXT,
      "bodyPreview" TEXT,
      "sentAt" TIMESTAMP(3) NOT NULL,
      "source" TEXT NOT NULL DEFAULT 'gmail-sync'
    )
  `);

  const allBuyouts = await listBuyouts();
  const TERMINAL = new Set(["Complete", "Cancelled", "DOA", "Not Possible"]);
  const active = allBuyouts.filter(
    (b) => b.clientEmail && !TERMINAL.has(b.lifecycleStage)
  );

  let stored = 0;
  let skipped = 0;
  const errors: string[] = [];

  // Process all active buyouts — 10 msgs per direction keeps API calls manageable
  for (const buyout of active) {
    try {
      const [sent, received] = await Promise.all([
        searchGmailMessages({
          clientEmail: buyout.clientEmail,
          direction: "sent",
          maxResults: 10
        }),
        searchGmailMessages({
          clientEmail: buyout.clientEmail,
          direction: "received",
          maxResults: 10
        })
      ]);

      for (const msg of [...sent, ...received]) {
        // Skip if already stored
        const exists = (await prisma.$queryRawUnsafe(
          `SELECT 1 FROM "StoredEmail" WHERE "gmailMessageId" = $1 LIMIT 1`,
          msg.id
        )) as Array<Record<string, unknown>>;

        if (exists.length > 0) {
          skipped++;
          continue;
        }

        const sentAt = new Date(msg.date);
        if (isNaN(sentAt.getTime())) continue;

        await prisma.$executeRawUnsafe(
          `INSERT INTO "StoredEmail" ("id","buyoutId","gmailMessageId","direction","fromAddress","toAddress","subject","snippet","bodyPreview","sentAt","source")
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
           ON CONFLICT ("gmailMessageId") DO NOTHING`,
          randomUUID(),
          buyout.id,
          msg.id,
          msg.direction,
          msg.from,
          msg.to,
          msg.subject,
          msg.snippet,
          msg.bodyText || null,
          sentAt,
          "gmail-sync"
        );
        stored++;
      }
    } catch (err) {
      errors.push(
        `${buyout.name}: ${err instanceof Error ? err.message : "unknown"}`
      );
    }
  }

  return NextResponse.json({
    processed: active.length,
    stored,
    skipped,
    errors: errors.slice(0, 5)
  });
}
