import { randomUUID } from "crypto";

import { NextResponse } from "next/server";

import { listBuyouts } from "@/lib/buyouts";
import { ensureEmailInfrastructure } from "@/lib/email-templates";
import { getGmailReadiness, searchPaymentEmails } from "@/lib/gmail";
import { hasDatabaseUrl, prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function normalizeName(value: string) {
  return value.toLowerCase().replace(/[^a-z\s]/g, " ").replace(/\s+/g, " ").trim();
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

  // Only do payment matching — no inbox scans (those are done on-demand in the drawer)
  let paymentsMatched = 0;
  const errors: string[] = [];

  try {
    const payments = await searchPaymentEmails(15);
    const allBuyouts = await listBuyouts();

    for (const payment of payments) {
      const alreadyProcessed = await prisma.$queryRawUnsafe(
        `SELECT COUNT(*)::int AS "count" FROM "BuyoutEvent"
         WHERE "eventType" = 'PAYMENT_DETECTED'
         AND "detail"::text LIKE $1`,
        `%${payment.gmailMessageId}%`
      ) as Array<{ count: number }>;

      if ((alreadyProcessed[0]?.count ?? 0) > 0) continue;

      // Match by email first, then by name
      const paymentEmail = payment.clientEmail.trim().toLowerCase();
      const paymentName = normalizeName(payment.clientName);

      const matchedBuyout =
        (paymentEmail ? allBuyouts.find((b) => b.clientEmail.trim().toLowerCase() === paymentEmail) : null) ??
        allBuyouts.find((b) => normalizeName(b.clientName || b.name) === paymentName) ??
        allBuyouts.find((b) => {
          const bn = normalizeName(b.clientName || b.name);
          return bn.includes(paymentName) || paymentName.includes(bn.split(" ").slice(0, 2).join(" "));
        });

      if (!matchedBuyout) continue;

      const financial = await prisma.buyoutFinancial.findUnique({
        where: { buyoutId: matchedBuyout.id }
      });

      const currentPaid = financial?.amountPaid ?? 0;
      const newPaid = currentPaid + Math.round(payment.amount);
      const quotedTotal = financial?.quotedTotal ?? 0;
      const newRemaining = Math.max(0, quotedTotal - newPaid);

      await prisma.buyoutFinancial.upsert({
        where: { buyoutId: matchedBuyout.id },
        update: { amountPaid: newPaid, remainingBalance: newRemaining },
        create: { buyoutId: matchedBuyout.id, quotedTotal, amountPaid: newPaid, remainingBalance: newRemaining }
      });

      // Auto-check workflow steps based on payment amount
      const isFullPayment = payment.amount >= (quotedTotal * 0.9);
      const isDeposit = !isFullPayment && payment.amount >= 200;
      const stepsToComplete = isFullPayment
        ? ["deposit-paid-and-terms-signed", "remaining-payment-received"]
        : isDeposit
          ? ["deposit-paid-and-terms-signed"]
          : [];

      for (const stepKey of stepsToComplete) {
        const existing = await prisma.buyoutWorkflowStep.findFirst({
          where: { buyoutId: matchedBuyout.id, stepKey }
        });

        if (existing && !existing.isComplete) {
          await prisma.buyoutWorkflowStep.update({
            where: { id: existing.id },
            data: { isComplete: true, completedAt: new Date(), completedBy: "payment-auto" }
          });
        } else if (!existing) {
          await prisma.buyoutWorkflowStep.create({
            data: {
              id: `${matchedBuyout.id}_${stepKey}`,
              buyoutId: matchedBuyout.id,
              stepKey,
              label: stepKey.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" "),
              stepGroup: "PAYMENT",
              isComplete: true,
              completedAt: new Date(),
              completedBy: "payment-auto"
            }
          });
        }
      }

      await prisma.$executeRawUnsafe(
        `INSERT INTO "BuyoutEvent" ("id", "buyoutId", "eventType", "summary", "detail", "createdBy")
         VALUES ($1, $2, 'PAYMENT_DETECTED', $3, $4::jsonb, $5)`,
        randomUUID(),
        matchedBuyout.id,
        `Payment $${payment.amount.toFixed(2)} received — Order #${payment.orderNumber} from ${payment.clientName} via ${payment.paymentMethod}`,
        JSON.stringify({
          gmailMessageId: payment.gmailMessageId,
          orderNumber: payment.orderNumber,
          amount: payment.amount,
          paymentMethod: payment.paymentMethod,
          clientName: payment.clientName,
          clientEmail: payment.clientEmail,
          matchedBuyoutName: matchedBuyout.name,
          isFullPayment,
          isDeposit,
          previousPaid: currentPaid,
          newTotal: newPaid
        }),
        "cron-payment-auto"
      );

      paymentsMatched++;
    }
  } catch (err) {
    errors.push(`Payment scan: ${err instanceof Error ? err.message : "unknown"}`);
  }

  return NextResponse.json({
    message: `${paymentsMatched} payments matched.`,
    paymentsMatched,
    errors: errors.slice(0, 5)
  });
}
