import { randomUUID } from "crypto";

import { NextResponse } from "next/server";

import { getGmailReadiness, searchPaymentEmails } from "@/lib/gmail";
import { hasDatabaseUrl, prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

function normalizeName(value: string) {
  return value.toLowerCase().replace(/[^a-z\s]/g, " ").replace(/\s+/g, " ").trim();
}

/**
 * Runs every 30 minutes. Only checks for payments against buyouts that are
 * actively waiting for money: stages QUOTE or DEPOSIT, or any active buyout
 * with a remaining balance > 0.
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

  // Find buyouts waiting for payment
  const awaitingPayment = await prisma.$queryRawUnsafe(`
    SELECT
      b."id",
      b."displayName",
      b."lifecycleStage",
      COALESCE(f."quotedTotal", 0) AS "quotedTotal",
      COALESCE(f."amountPaid", 0) AS "amountPaid",
      COALESCE(f."remainingBalance", 0) AS "remainingBalance",
      (
        SELECT string_agg(bc."email", ',')
        FROM "BuyoutContact" bc
        WHERE bc."buyoutId" = b."id" AND bc."email" IS NOT NULL
      ) AS "contactEmails"
    FROM "Buyout" b
    LEFT JOIN "BuyoutFinancial" f ON f."buyoutId" = b."id"
    WHERE (
      b."lifecycleStage" IN ('QUOTE', 'DEPOSIT')
      OR (
        b."lifecycleStage" NOT IN ('COMPLETE', 'CANCELLED', 'DOA', 'NOT_POSSIBLE', 'ON_HOLD')
        AND COALESCE(f."remainingBalance", 0) > 0
      )
    )
  `) as Array<{
    id: string;
    displayName: string;
    lifecycleStage: string;
    quotedTotal: number;
    amountPaid: number;
    remainingBalance: number;
    contactEmails: string | null;
  }>;

  if (awaitingPayment.length === 0) {
    return NextResponse.json({ message: "No buyouts awaiting payment.", matched: 0 });
  }

  // Search recent payment emails (last 3 days for fast turnaround)
  const payments = await searchPaymentEmails(20, 3);

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

    // Match to an awaiting-payment buyout
    const pe = payment.clientEmail.trim().toLowerCase();
    const pn = normalizeName(payment.clientName);

    const buyout = awaitingPayment.find((b) => {
      const emails = (b.contactEmails || "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
      if (pe && emails.includes(pe)) return true;
      const bn = normalizeName(b.displayName);
      return bn === pn || bn.includes(pn) || pn.includes(bn);
    });

    if (!buyout) continue;

    try {
      const paid = buyout.amountPaid + Math.round(payment.amount);
      const total = buyout.quotedTotal;

      await prisma.buyoutFinancial.upsert({
        where: { buyoutId: buyout.id },
        update: { amountPaid: paid, remainingBalance: Math.max(0, total - paid) },
        create: { buyoutId: buyout.id, quotedTotal: total, amountPaid: paid, remainingBalance: Math.max(0, total - paid) }
      });

      // Auto-check payment workflow steps
      const isFull = payment.amount >= total * 0.9;
      const steps = isFull
        ? ["deposit-paid-and-terms-signed", "remaining-payment-received"]
        : payment.amount >= 200 ? ["deposit-paid-and-terms-signed"] : [];

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
        JSON.stringify({ gmailMessageId: payment.gmailMessageId, orderNumber: payment.orderNumber, amount: payment.amount, paymentMethod: payment.paymentMethod, clientName: payment.clientName, clientEmail: payment.clientEmail, matchedTo: buyout.displayName, isFull }),
        "cron-payments"
      );
      matched++;

      // Update in-memory record so next payment in loop uses updated totals
      buyout.amountPaid = paid;
      buyout.remainingBalance = Math.max(0, total - paid);
    } catch (err) {
      errors.push(`${buyout.displayName}: ${err instanceof Error ? err.message : "unknown"}`);
    }
  }

  return NextResponse.json({
    awaitingCount: awaitingPayment.length,
    emailsScanned: payments.length,
    matched,
    skipped,
    errors: errors.slice(0, 3)
  });
}
