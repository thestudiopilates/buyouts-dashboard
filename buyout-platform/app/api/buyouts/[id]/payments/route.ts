import { randomUUID } from "crypto";

import { NextResponse } from "next/server";

import { getBuyout } from "@/lib/buyouts";
import { listPaymentActivity } from "@/lib/email-templates";
import { ensureEmailInfrastructure } from "@/lib/email-templates";
import { getGmailReadiness, searchPaymentEmails } from "@/lib/gmail";
import { hasDatabaseUrl, prisma } from "@/lib/prisma";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;

  try {
    const payments = await listPaymentActivity(id);
    return NextResponse.json({ payments });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load payments.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;

  if (!hasDatabaseUrl()) {
    return NextResponse.json({ error: "Database required." }, { status: 503 });
  }

  try {
    const body = (await request.json()) as {
      amount?: number;
      paymentMethod?: string;
      date?: string;
      notes?: string;
    };

    const amount = Number(body.amount ?? 0);
    if (!amount || amount <= 0) {
      return NextResponse.json({ error: "Amount must be greater than 0." }, { status: 400 });
    }

    const method = String(body.paymentMethod ?? "").trim() || "Other";
    const date = String(body.date ?? "").trim() || new Date().toISOString().slice(0, 10);
    const notes = String(body.notes ?? "").trim();

    await ensureEmailInfrastructure();

    await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(
        `INSERT INTO "BuyoutEvent" ("id","buyoutId","eventType","summary","detail","createdBy")
         VALUES ($1,$2,'MANUAL_PAYMENT',$3,$4::jsonb,$5)`,
        randomUUID(),
        id,
        `Manual payment recorded: $${amount} via ${method}`,
        JSON.stringify({ amount, paymentMethod: method, date, notes, recordedBy: "team" }),
        "team"
      );

      // Increment amountPaid and recalculate remainingBalance
      await tx.$executeRawUnsafe(
        `INSERT INTO "BuyoutFinancial" ("id","buyoutId","amountPaid","remainingBalance","createdAt","updatedAt")
         VALUES ($1,$2,$3,0,now(),now())
         ON CONFLICT ("buyoutId") DO UPDATE
           SET "amountPaid" = "BuyoutFinancial"."amountPaid" + $3,
               "remainingBalance" = GREATEST(0, COALESCE("BuyoutFinancial"."quotedTotal",0) - ("BuyoutFinancial"."amountPaid" + $3)),
               "updatedAt" = now()`,
        randomUUID(),
        id,
        amount
      );
    });

    const payments = await listPaymentActivity(id);
    return NextResponse.json({ payments });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to save payment.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function normalizeName(value: string) {
  return value.toLowerCase().replace(/[^a-z\s]/g, " ").replace(/\s+/g, " ").trim();
}

/** On-demand Gmail scan for a specific buyout's payments */
export async function PUT(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;

  if (!hasDatabaseUrl()) {
    return NextResponse.json({ error: "Database required." }, { status: 503 });
  }

  const gmail = getGmailReadiness();
  if (!gmail.ready) {
    // No Gmail — just return existing payments
    const payments = await listPaymentActivity(id);
    return NextResponse.json({ payments, scanned: false });
  }

  try {
    const buyout = await getBuyout(id);
    if (!buyout) {
      return NextResponse.json({ error: "Buyout not found." }, { status: 404 });
    }

    // Search recent payment emails (last 14 days, up to 20)
    const allPayments = await searchPaymentEmails(20, 14);

    // Match to this buyout by email or name
    const be = (buyout.clientEmail || "").trim().toLowerCase();
    const bn = normalizeName(buyout.clientName || buyout.name);
    const matched = allPayments.filter((p) => {
      const pe = p.clientEmail.trim().toLowerCase();
      const pn = normalizeName(p.clientName);
      return (be && pe === be) || pn === bn || pn.includes(bn) || bn.includes(pn);
    });

    let newCount = 0;

    for (const payment of matched) {
      // Skip if already processed
      const exists = await prisma.$queryRawUnsafe(
        `SELECT 1 FROM "BuyoutEvent" WHERE "eventType" = 'PAYMENT_DETECTED' AND "detail"::text LIKE $1 LIMIT 1`,
        `%${payment.gmailMessageId}%`
      ) as Array<Record<string, unknown>>;

      if (exists.length > 0) continue;

      // Update financials
      const fin = await prisma.buyoutFinancial.findUnique({ where: { buyoutId: id } });
      const paid = (fin?.amountPaid ?? 0) + Math.round(payment.amount);
      const total = fin?.quotedTotal ?? 0;

      await prisma.buyoutFinancial.upsert({
        where: { buyoutId: id },
        update: { amountPaid: paid, remainingBalance: Math.max(0, total - paid) },
        create: { buyoutId: id, quotedTotal: total, amountPaid: paid, remainingBalance: Math.max(0, total - paid) }
      });

      // Auto-check payment workflow steps
      const isFull = payment.amount >= total * 0.9;
      const steps = isFull
        ? ["deposit-paid-and-terms-signed", "remaining-payment-received"]
        : payment.amount >= 200 ? ["deposit-paid-and-terms-signed"] : [];

      for (const key of steps) {
        const step = await prisma.buyoutWorkflowStep.findFirst({ where: { buyoutId: id, stepKey: key } });
        if (step && !step.isComplete) {
          await prisma.buyoutWorkflowStep.update({ where: { id: step.id }, data: { isComplete: true, completedAt: new Date(), completedBy: "payment-auto" } });
        }
      }

      // Record event
      await prisma.$executeRawUnsafe(
        `INSERT INTO "BuyoutEvent" ("id","buyoutId","eventType","summary","detail","createdBy") VALUES ($1,$2,'PAYMENT_DETECTED',$3,$4::jsonb,$5)`,
        randomUUID(), id,
        `Payment $${payment.amount.toFixed(2)} — Order #${payment.orderNumber} from ${payment.clientName} via ${payment.paymentMethod}`,
        JSON.stringify({ gmailMessageId: payment.gmailMessageId, orderNumber: payment.orderNumber, amount: payment.amount, paymentMethod: payment.paymentMethod, clientName: payment.clientName, clientEmail: payment.clientEmail, matchedTo: buyout.name, isFull }),
        "on-demand"
      );
      newCount++;
    }

    const payments = await listPaymentActivity(id);
    return NextResponse.json({ payments, scanned: true, found: matched.length, new: newCount });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Payment scan failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
