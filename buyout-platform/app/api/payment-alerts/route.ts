import { NextRequest, NextResponse } from "next/server";

import { hasDatabaseUrl, prisma } from "@/lib/prisma";

export type PaymentAlertRecord = {
  id: string;
  buyoutId: string;
  buyoutName: string;
  amount: number;
  clientName: string;
  paymentMethod: string;
  detectedAt: string;
  hoursAgo: number;
};

export async function GET() {
  if (!hasDatabaseUrl()) {
    return NextResponse.json({ alerts: [] });
  }

  try {
    // Recent payment events (last 72 hours) that haven't been dismissed
    const rows = await prisma.$queryRawUnsafe(`
      SELECT
        e."id",
        e."buyoutId",
        b."displayName" AS "buyoutName",
        e."detail",
        e."createdAt"
      FROM "BuyoutEvent" e
      JOIN "Buyout" b ON b."id" = e."buyoutId"
      WHERE e."eventType" IN ('PAYMENT_DETECTED', 'MANUAL_PAYMENT')
        AND e."createdAt" > NOW() - INTERVAL '72 hours'
      ORDER BY e."createdAt" DESC
      LIMIT 20
    `) as Array<{
      id: string;
      buyoutId: string;
      buyoutName: string;
      detail: Record<string, unknown> | null;
      createdAt: Date;
    }>;

    // Check which ones have been dismissed (stored as BuyoutEvent with type PAYMENT_ALERT_DISMISSED)
    const dismissedIds = new Set<string>();
    if (rows.length > 0) {
      const dismissed = await prisma.$queryRawUnsafe(`
        SELECT "detail"->>'paymentEventId' AS "pid"
        FROM "BuyoutEvent"
        WHERE "eventType" = 'PAYMENT_ALERT_DISMISSED'
          AND "createdAt" > NOW() - INTERVAL '72 hours'
      `) as Array<{ pid: string }>;
      for (const d of dismissed) dismissedIds.add(d.pid);
    }

    const alerts: PaymentAlertRecord[] = rows
      .filter((r) => !dismissedIds.has(r.id))
      .map((row) => {
        const detail = (row.detail ?? {}) as Record<string, unknown>;
        return {
          id: row.id,
          buyoutId: row.buyoutId,
          buyoutName: row.buyoutName,
          amount: Number(detail.amount ?? 0),
          clientName: String(detail.clientName ?? row.buyoutName),
          paymentMethod: String(detail.paymentMethod ?? "Unknown"),
          detectedAt: row.createdAt.toISOString(),
          hoursAgo: Math.floor((Date.now() - row.createdAt.getTime()) / 3600000)
        };
      });

    return NextResponse.json({ alerts });
  } catch {
    return NextResponse.json({ alerts: [] });
  }
}

export async function PATCH(request: NextRequest) {
  if (!hasDatabaseUrl()) {
    return NextResponse.json({ ok: false }, { status: 500 });
  }

  try {
    const body = (await request.json()) as { ids?: string[] };
    const ids = body.ids;
    if (!ids || ids.length === 0) {
      return NextResponse.json({ ok: false, error: "No IDs" }, { status: 400 });
    }

    // Record dismissals as events (no schema change needed)
    const { randomUUID } = await import("crypto");
    for (const id of ids) {
      await prisma.$executeRawUnsafe(
        `INSERT INTO "BuyoutEvent" ("id","buyoutId","eventType","summary","detail","createdBy")
         SELECT $1, "buyoutId", 'PAYMENT_ALERT_DISMISSED', 'Payment alert dismissed', jsonb_build_object('paymentEventId', $2), 'team'
         FROM "BuyoutEvent" WHERE "id" = $2`,
        randomUUID(), id
      );
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
