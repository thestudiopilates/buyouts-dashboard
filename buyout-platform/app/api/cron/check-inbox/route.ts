import { randomUUID } from "crypto";

import { NextResponse } from "next/server";

import { listBuyouts } from "@/lib/buyouts";
import { ensureEmailInfrastructure } from "@/lib/email-templates";
import { getGmailReadiness, searchClientReplies, searchPaymentEmails } from "@/lib/gmail";
import { hasDatabaseUrl, prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const TERMINAL = new Set(["Complete", "Cancelled", "DOA", "Not Possible"]);

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
  const payments = await searchPaymentEmails(10);
  const allBuyouts = await listBuyouts();

  let matched = 0;
  let skipped = 0;
  let reactivated = 0;
  const errors: string[] = [];

  for (const payment of payments) {
    // Skip if already processed
    const exists = await prisma.$queryRawUnsafe(
      `SELECT 1 FROM "BuyoutEvent" WHERE "eventType" = 'PAYMENT_DETECTED' AND "detail"::text LIKE $1 LIMIT 1`,
      `%${payment.gmailMessageId}%`
    ) as Array<Record<string, unknown>>;

    if (exists.length > 0) { skipped++; continue; }

    // Match payment to buyout (search ALL buyouts including terminal)
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

      // Auto-reactivate terminal buyouts on payment
      if (TERMINAL.has(buyout.lifecycleStage)) {
        await prisma.$executeRawUnsafe(
          `UPDATE "Buyout" SET "lifecycleStage" = 'DEPOSIT', "stageLockedManually" = FALSE, "ballInCourt" = 'TEAM', "nextAction" = 'Payment received — review and update status', "lastActionAt" = NOW() WHERE "id" = $1`,
          buyout.id
        );
        await prisma.$executeRawUnsafe(
          `INSERT INTO "BuyoutEvent" ("id","buyoutId","eventType","summary","detail","createdBy") VALUES ($1,$2,'REACTIVATED',$3,$4::jsonb,$5)`,
          randomUUID(), buyout.id,
          `Auto-reactivated: payment of $${payment.amount.toFixed(2)} received from ${payment.clientName} while in ${buyout.lifecycleStage} status`,
          JSON.stringify({ previousStage: buyout.lifecycleStage, trigger: "payment", amount: payment.amount, gmailMessageId: payment.gmailMessageId }),
          "cron"
        );
        reactivated++;
      }

      // Record payment event
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

  // --- Client reply detection ---
  // Collect client emails from ALL buyouts (including terminal) so we can detect
  // activity on DOA/Cancelled accounts and auto-reactivate them
  const clientEmailMap = new Map<string, typeof allBuyouts>();
  for (const b of allBuyouts) {
    const email = (b.clientEmail || "").trim().toLowerCase();
    if (!email) continue;
    const existing = clientEmailMap.get(email) ?? [];
    existing.push(b);
    clientEmailMap.set(email, existing);
  }

  let repliesDetected = 0;
  let repliesSkipped = 0;

  if (clientEmailMap.size > 0) {
    const replies = await searchClientReplies([...clientEmailMap.keys()], 3);

    for (const reply of replies) {
      // Skip if this Gmail message already has an InboxAlert
      const exists = await prisma.$queryRawUnsafe(
        `SELECT 1 FROM "InboxAlert" WHERE "gmailMessageId" = $1 LIMIT 1`,
        reply.gmailMessageId
      ) as Array<Record<string, unknown>>;

      if (exists.length > 0) { repliesSkipped++; continue; }

      // Match reply to buyout(s) by client email
      const matchedBuyouts = clientEmailMap.get(reply.fromEmail) ?? [];
      if (matchedBuyouts.length === 0) continue;

      // Create an InboxAlert for each matched buyout
      for (const buyout of matchedBuyouts) {
        await prisma.$executeRawUnsafe(
          `INSERT INTO "InboxAlert" ("id","buyoutId","clientEmail","gmailMessageId","subject","snippet","receivedAt","isRead","isDismissed")
           VALUES ($1,$2,$3,$4,$5,$6,$7,FALSE,FALSE)`,
          randomUUID(),
          buyout.id,
          reply.fromEmail,
          reply.gmailMessageId,
          reply.subject.slice(0, 200),
          reply.snippet.slice(0, 300),
          new Date(reply.date)
        );

        // Auto-reactivate terminal buyouts on client reply
        if (TERMINAL.has(buyout.lifecycleStage)) {
          await prisma.$executeRawUnsafe(
            `UPDATE "Buyout" SET "lifecycleStage" = 'INQUIRY', "stageLockedManually" = FALSE, "ballInCourt" = 'TEAM', "nextAction" = 'Client replied — review and respond', "lastActionAt" = NOW() WHERE "id" = $1`,
            buyout.id
          );
          await prisma.$executeRawUnsafe(
            `INSERT INTO "BuyoutEvent" ("id","buyoutId","eventType","summary","detail","createdBy") VALUES ($1,$2,'REACTIVATED',$3,$4::jsonb,$5)`,
            randomUUID(), buyout.id,
            `Auto-reactivated: client reply from ${reply.fromEmail} while in ${buyout.lifecycleStage} status — "${reply.subject.slice(0, 60)}"`,
            JSON.stringify({ previousStage: buyout.lifecycleStage, trigger: "client-reply", fromEmail: reply.fromEmail, subject: reply.subject, gmailMessageId: reply.gmailMessageId }),
            "cron"
          );
          reactivated++;
        } else {
          // Active buyout — flip ball in court to Team
          await prisma.$executeRawUnsafe(
            `UPDATE "Buyout" SET "ballInCourt" = 'TEAM', "lastActionAt" = NOW() WHERE "id" = $1`,
            buyout.id
          );
        }

        // Auto-check "customer-responded" workflow step if not already done
        await prisma.$executeRawUnsafe(
          `UPDATE "BuyoutWorkflowStep"
           SET "isComplete" = TRUE, "completedAt" = NOW(), "completedBy" = 'client-reply-auto'
           WHERE "buyoutId" = $1 AND "stepKey" = 'customer-responded' AND "isComplete" = FALSE`,
          buyout.id
        );

        // Record a BuyoutEvent for the activity trail
        await prisma.$executeRawUnsafe(
          `INSERT INTO "BuyoutEvent" ("id","buyoutId","eventType","summary","detail","createdBy")
           VALUES ($1,$2,'CLIENT_REPLY',$3,$4::jsonb,$5)`,
          randomUUID(),
          buyout.id,
          `Client reply received from ${reply.fromEmail}: ${reply.subject.slice(0, 80)}`,
          JSON.stringify({ gmailMessageId: reply.gmailMessageId, fromEmail: reply.fromEmail, subject: reply.subject, snippet: reply.snippet.slice(0, 200) }),
          "cron"
        );

        repliesDetected++;
      }
    }
  }

  return NextResponse.json({
    payments: { matched, skipped, total: payments.length },
    replies: { detected: repliesDetected, skipped: repliesSkipped },
    reactivated,
    errors: errors.slice(0, 3)
  });
}
