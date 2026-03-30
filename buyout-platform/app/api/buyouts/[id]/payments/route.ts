import { randomUUID } from "crypto";

import { NextResponse } from "next/server";

import { listPaymentActivity } from "@/lib/email-templates";
import { ensureEmailInfrastructure } from "@/lib/email-templates";
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

      // Increment amountPaid on the financial record (upsert in case it doesn't exist yet)
      await tx.$executeRawUnsafe(
        `INSERT INTO "BuyoutFinancial" ("id","buyoutId","amountPaid","createdAt","updatedAt")
         VALUES ($1,$2,$3,now(),now())
         ON CONFLICT ("buyoutId") DO UPDATE
           SET "amountPaid" = "BuyoutFinancial"."amountPaid" + $3,
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
