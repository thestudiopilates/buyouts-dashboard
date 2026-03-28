import { randomUUID } from "crypto";

import { NextResponse } from "next/server";

import { listBuyouts } from "@/lib/buyouts";
import { ensureEmailInfrastructure } from "@/lib/email-templates";
import { getGmailReadiness, searchGmailMessages } from "@/lib/gmail";
import { hasDatabaseUrl, prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function ensureInboxTable() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "InboxAlert" (
      "id" TEXT PRIMARY KEY,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "buyoutId" TEXT NOT NULL,
      "clientEmail" TEXT NOT NULL,
      "gmailMessageId" TEXT NOT NULL UNIQUE,
      "subject" TEXT,
      "snippet" TEXT,
      "receivedAt" TIMESTAMP(3) NOT NULL,
      "respondedAt" TIMESTAMP(3),
      "isRead" BOOLEAN NOT NULL DEFAULT FALSE,
      "isDismissed" BOOLEAN NOT NULL DEFAULT FALSE
    )
  `);

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "InboxAlert_buyoutId_idx"
    ON "InboxAlert" ("buyoutId", "receivedAt" DESC)
  `);
}

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!hasDatabaseUrl()) {
    return NextResponse.json({ error: "Database required." }, { status: 400 });
  }

  const gmail = getGmailReadiness();
  if (!gmail.ready) {
    return NextResponse.json({ error: "Gmail not configured.", gmailReady: false }, { status: 400 });
  }

  await ensureEmailInfrastructure();
  await ensureInboxTable();

  const buyouts = await listBuyouts();
  const activeBuyouts = buyouts.filter(
    (b) => !["Complete", "Cancelled", "DOA", "Not Possible"].includes(b.lifecycleStage) && b.clientEmail
  );

  let newAlerts = 0;
  let resolved = 0;
  const errors: string[] = [];

  for (const buyout of activeBuyouts) {
    try {
      const received = await searchGmailMessages({
        clientEmail: buyout.clientEmail,
        direction: "received",
        maxResults: 5
      });

      if (received.length === 0) continue;

      const sent = await searchGmailMessages({
        clientEmail: buyout.clientEmail,
        direction: "sent",
        maxResults: 5
      });

      const latestSentTime = sent.length > 0
        ? Math.max(...sent.map((m) => new Date(m.date).getTime()))
        : 0;

      for (const msg of received) {
        const receivedTime = new Date(msg.date).getTime();
        if (isNaN(receivedTime)) continue;

        const wasRespondedTo = latestSentTime > receivedTime;

        const existing = await prisma.$queryRawUnsafe(
          `SELECT "id", "respondedAt" FROM "InboxAlert" WHERE "gmailMessageId" = $1 LIMIT 1`,
          msg.id
        ) as Array<{ id: string; respondedAt: Date | null }>;

        if (existing.length > 0) {
          if (wasRespondedTo && !existing[0].respondedAt) {
            await prisma.$executeRawUnsafe(
              `UPDATE "InboxAlert" SET "respondedAt" = $1 WHERE "id" = $2`,
              new Date(latestSentTime),
              existing[0].id
            );
            resolved++;
          }
          continue;
        }

        await prisma.$executeRawUnsafe(
          `INSERT INTO "InboxAlert" ("id", "buyoutId", "clientEmail", "gmailMessageId", "subject", "snippet", "receivedAt", "respondedAt")
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          randomUUID(),
          buyout.id,
          buyout.clientEmail,
          msg.id,
          msg.subject ?? "",
          msg.snippet ?? "",
          new Date(receivedTime),
          wasRespondedTo ? new Date(latestSentTime) : null
        );
        newAlerts++;
      }
    } catch (err) {
      errors.push(`${buyout.name}: ${err instanceof Error ? err.message : "unknown"}`);
    }
  }

  return NextResponse.json({
    message: `Checked ${activeBuyouts.length} buyouts. ${newAlerts} new alerts, ${resolved} resolved.`,
    checked: activeBuyouts.length,
    newAlerts,
    resolved,
    errors: errors.slice(0, 5)
  });
}
