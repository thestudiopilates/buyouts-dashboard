import { randomUUID } from "crypto";

import { NextResponse } from "next/server";

import { listBuyouts } from "@/lib/buyouts";
import { ensureEmailInfrastructure } from "@/lib/email-templates";
import { getGmailReadiness, searchPaymentEmails } from "@/lib/gmail";
import { hasDatabaseUrl, prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

function normalizeName(value: string) {
  return value.toLowerCase().replace(/[^a-z\s]/g, " ").replace(/\s+/g, " ").trim();
}

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!hasDatabaseUrl() || !getGmailReadiness().ready) {
    return NextResponse.json({ error: "DB or Gmail not configured." }, { status: 400 });
  }

  await ensureEmailInfrastructure();

  // Only fetch recent payments (last 7 days) — not the full 90-day archive
  // Historical backfill is done once via /api/admin/backfill-activity
  const payments = await searchPaymentEmails(10);
  const allBuyouts = await listBuyouts();

  let matched = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const payment of payments) {
    // Skip if already processed
    const exists = await prisma.$queryRawUnsafe(
      `SELECT 1 FROM "BuyoutEvent" WHERE "eventType" = 'PAYMENT_DETECTED' AND "detail"::text LIKE $1 LIMIT 1`,
      `%${payment.gmailMessageId}%`
    ) as Array<Record<string, unknown>>;

    if (exists.length > 0) { skipped++; continue; }

    // Match payment to buyout
    const pe = payment.clientEmail.trim().toLowerCase();
    const pn = normalizeName(payment.clientName);
    const buyout =
      (pe ? allBuyouts.find((b) => b.clientEmail.trim().toLowerCase() === pe) : null) ??
      allBuyouts.find((b) => normalizeName(b.clientName || b.name) === pn) ??
      allBuyouts.find((b) => normalizeName(b.clientName || b.name).includes(pn));

    if (!buyout) continue;

    try {
      // Update financials
      const fin = await prisma.buyoutFinancial.findUnique({ where: { buyoutId: buyout.id } });
      const paid = (fin?.amountPaid ?? 0) + Math.round(payment.amount);
      const total = fin?.quotedTotal ?? 0;

      await prisma.buyoutFinancial.upsert({
        where: { buyoutId: buyout.id },
        update: { amountPaid: paid, remainingBalance: Math.max(0, total - paid) },
        create: { buyoutId: buyout.id, quotedTotal: total, amountPaid: paid, remainingBalance: Math.max(0, total - paid) }
      });

      // Auto-check payment workflow steps
      const isFull = payment.amount >= total * 0.9;
      const steps = isFull ? ["deposit-paid-and-terms-signed", "remaining-payment-received"] : payment.amount >= 200 ? ["deposit-paid-and-terms-signed"] : [];

      for (const key of steps) {
        const step = await prisma.buyoutWorkflowStep.findFirst({ where: { buyoutId: buyout.id, stepKey: key } });
        if (step && !step.isComplete) {
          await prisma.buyoutWorkflowStep.update({ where: { id: step.id }, data: { isComplete: true, completedAt: new Date(), completedBy: "payment-auto" } });
        }
      }

      // Record event
      await prisma.$executeRawUnsafe(
        `INSERT INTO "BuyoutEvent" ("id","buyoutId","eventType","summary","detail","createdBy") VALUES ($1,$2,'PAYMENT_DETECTED',$3,$4::jsonb,$5)`,
        randomUUID(), buyout.id,
        `Payment $${payment.amount.toFixed(2)} — Order #${payment.orderNumber} from ${payment.clientName} via ${payment.paymentMethod}`,
        JSON.stringify({ gmailMessageId: payment.gmailMessageId, orderNumber: payment.orderNumber, amount: payment.amount, paymentMethod: payment.paymentMethod, clientName: payment.clientName, clientEmail: payment.clientEmail, matchedTo: buyout.name, isFull }),
        "cron"
      );
      matched++;
    } catch (err) {
      errors.push(`${buyout.name}: ${err instanceof Error ? err.message : "unknown"}`);
    }
  }

  return NextResponse.json({ matched, skipped, total: payments.length, errors: errors.slice(0, 3) });
}
