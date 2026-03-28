import { randomUUID } from "crypto";

import { NextResponse } from "next/server";

import { listBuyouts } from "@/lib/buyouts";
import { ensureEmailInfrastructure } from "@/lib/email-templates";
import { getGmailReadiness, searchGmailMessages, searchPaymentEmails } from "@/lib/gmail";
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

function normalizeName(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function firstName(value: string) {
  return normalizeName(value).split(" ")[0] ?? "";
}

function matchPaymentToBuyout(
  payment: { clientEmail: string; clientName: string },
  buyouts: Awaited<ReturnType<typeof listBuyouts>>
) {
  const paymentEmail = payment.clientEmail.trim().toLowerCase();
  const paymentName = normalizeName(payment.clientName);
  const paymentFirstName = firstName(payment.clientName);

  if (paymentEmail) {
    const exactEmail = buyouts.find((buyout) => buyout.clientEmail.trim().toLowerCase() === paymentEmail);
    if (exactEmail) {
      return { buyout: exactEmail, matchedBy: "email" };
    }
  }

  if (paymentName) {
    const fullNameMatch = buyouts.find((buyout) => normalizeName(buyout.clientName || buyout.name) === paymentName);
    if (fullNameMatch) {
      return { buyout: fullNameMatch, matchedBy: "full-name" };
    }
  }

  if (paymentFirstName) {
    const firstNameMatches = buyouts.filter((buyout) => firstName(buyout.clientName || buyout.name) === paymentFirstName);
    if (firstNameMatches.length === 1) {
      return { buyout: firstNameMatches[0], matchedBy: "first-name" };
    }
  }

  return { buyout: null, matchedBy: null };
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

  // ── Payment Detection ────────────────────────────────────
  let paymentsMatched = 0;

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

      const { buyout: matchedBuyout, matchedBy } = matchPaymentToBuyout(payment, allBuyouts);

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
        update: {
          amountPaid: newPaid,
          remainingBalance: newRemaining
        },
        create: {
          buyoutId: matchedBuyout.id,
          quotedTotal,
          amountPaid: newPaid,
          remainingBalance: newRemaining
        }
      });

      const depositThreshold = 200;
      const isFullPayment = payment.amount >= (quotedTotal * 0.9);
      const isDeposit = !isFullPayment && payment.amount >= depositThreshold;

      if (isFullPayment) {
        const steps = ["deposit-paid-and-terms-signed", "remaining-payment-received"];
        for (const stepKey of steps) {
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
      } else if (isDeposit) {
        const stepKey = "deposit-paid-and-terms-signed";
        const existing = await prisma.buyoutWorkflowStep.findFirst({
          where: { buyoutId: matchedBuyout.id, stepKey }
        });

        if (existing && !existing.isComplete) {
          await prisma.buyoutWorkflowStep.update({
            where: { id: existing.id },
            data: { isComplete: true, completedAt: new Date(), completedBy: "payment-auto" }
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
          productName: payment.productName,
          rawSubject: payment.rawSubject,
          date: payment.date,
          threadId: payment.threadId,
          bodyText: payment.bodyText,
          matchedBuyoutName: matchedBuyout.name,
          matchedBy,
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
    message: `Checked ${activeBuyouts.length} buyouts. ${newAlerts} new alerts, ${resolved} resolved, ${paymentsMatched} payments matched.`,
    checked: activeBuyouts.length,
    newAlerts,
    resolved,
    paymentsMatched,
    errors: errors.slice(0, 5)
  });
}
