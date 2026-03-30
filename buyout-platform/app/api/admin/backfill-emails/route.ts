import { randomUUID } from "crypto";

import { NextResponse } from "next/server";

import { listBuyouts } from "@/lib/buyouts";
import { ensureEmailInfrastructure } from "@/lib/email-templates";
import { getGmailReadiness, searchGmailMessages, searchPaymentEmails } from "@/lib/gmail";
import { hasDatabaseUrl, prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function ensureStoredEmailTable() {
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
      "source" TEXT NOT NULL DEFAULT 'gmail-backfill'
    )
  `);

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "StoredEmail_buyoutId_idx"
    ON "StoredEmail" ("buyoutId", "sentAt" DESC)
  `);
}

export async function POST(request: Request) {
  if (!hasDatabaseUrl() || !getGmailReadiness().ready) {
    return NextResponse.json({ error: "DB or Gmail not configured." }, { status: 400 });
  }

  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("mode") ?? "emails"; // "emails" or "payments"

  await ensureEmailInfrastructure();
  await ensureStoredEmailTable();

  const buyouts = await listBuyouts();
  const targetIds = searchParams.get("buyoutIds")?.split(",").filter(Boolean);
  const active = targetIds
    ? buyouts.filter((b) => targetIds.includes(b.id))
    : buyouts.filter((b) => b.clientEmail && !["Complete", "Cancelled", "DOA", "Not Possible"].includes(b.lifecycleStage));

  if (mode === "payments") {
    // Backfill payments from 90-day window
    const payments = await searchPaymentEmails(30, 90);
    let matched = 0;

    for (const payment of payments) {
      const exists = await prisma.$queryRawUnsafe(
        `SELECT 1 FROM "BuyoutEvent" WHERE "eventType" = 'PAYMENT_DETECTED' AND "detail"::text LIKE $1 LIMIT 1`,
        `%${payment.gmailMessageId}%`
      ) as Array<Record<string, unknown>>;
      if (exists.length > 0) continue;

      const pe = payment.clientEmail.trim().toLowerCase();
      const pn = payment.clientName.toLowerCase();
      const buyout = (pe ? buyouts.find((b) => b.clientEmail.trim().toLowerCase() === pe) : null)
        ?? buyouts.find((b) => (b.clientName || b.name).toLowerCase().includes(pn));

      if (!buyout) continue;

      const fin = await prisma.buyoutFinancial.findUnique({ where: { buyoutId: buyout.id } });
      const paid = (fin?.amountPaid ?? 0) + Math.round(payment.amount);
      const total = fin?.quotedTotal ?? 0;

      await prisma.buyoutFinancial.upsert({
        where: { buyoutId: buyout.id },
        update: { amountPaid: paid, remainingBalance: Math.max(0, total - paid) },
        create: { buyoutId: buyout.id, quotedTotal: total, amountPaid: paid, remainingBalance: Math.max(0, total - paid) }
      });

      await prisma.$executeRawUnsafe(
        `INSERT INTO "BuyoutEvent" ("id","buyoutId","eventType","summary","detail","createdBy") VALUES ($1,$2,'PAYMENT_DETECTED',$3,$4::jsonb,$5)`,
        randomUUID(), buyout.id,
        `Payment $${payment.amount.toFixed(2)} — Order #${payment.orderNumber} from ${payment.clientName}`,
        JSON.stringify({ gmailMessageId: payment.gmailMessageId, orderNumber: payment.orderNumber, amount: payment.amount, paymentMethod: payment.paymentMethod, clientName: payment.clientName, clientEmail: payment.clientEmail }),
        "backfill"
      );
      matched++;
    }

    return NextResponse.json({ mode: "payments", matched, total: payments.length });
  }

  // Backfill sent/received emails for active buyouts — store in DB
  let stored = 0;
  const errors: string[] = [];

  // Process max 5 buyouts per run to stay within timeout (or all if targeted)
  const batch = targetIds ? active : active.slice(0, 5);

  for (const buyout of batch) {
    try {
      const [sent, received] = await Promise.all([
        searchGmailMessages({ clientEmail: buyout.clientEmail, direction: "sent", maxResults: 20 }),
        searchGmailMessages({ clientEmail: buyout.clientEmail, direction: "received", maxResults: 20 })
      ]);

      for (const msg of [...sent, ...received]) {
        const exists = await prisma.$queryRawUnsafe(
          `SELECT 1 FROM "StoredEmail" WHERE "gmailMessageId" = $1 LIMIT 1`,
          msg.id
        ) as Array<Record<string, unknown>>;
        if (exists.length > 0) continue;

        const sentAt = new Date(msg.date);
        if (isNaN(sentAt.getTime())) continue;

        await prisma.$executeRawUnsafe(
          `INSERT INTO "StoredEmail" ("id","buyoutId","gmailMessageId","direction","fromAddress","toAddress","subject","snippet","sentAt","source")
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
          randomUUID(), buyout.id, msg.id, msg.direction, msg.from, msg.to, msg.subject, msg.snippet, sentAt, "gmail-backfill"
        );
        stored++;
      }
    } catch (err) {
      errors.push(`${buyout.name}: ${err instanceof Error ? err.message : "unknown"}`);
    }
  }

  return NextResponse.json({
    mode: "emails",
    processed: batch.length,
    remaining: active.length - batch.length,
    stored,
    errors: errors.slice(0, 3)
  });
}
