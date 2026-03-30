import { NextRequest, NextResponse } from "next/server";

import { hasDatabaseUrl, prisma } from "@/lib/prisma";

export type InboxAlertRecord = {
  id: string;
  buyoutId: string;
  clientEmail: string;
  subject: string;
  snippet: string;
  receivedAt: string;
  respondedAt: string | null;
  isRead: boolean;
  hoursWaiting: number;
};

export async function GET() {
  if (!hasDatabaseUrl()) {
    return NextResponse.json({ alerts: [] });
  }

  try {
    const rows = await prisma.$queryRawUnsafe(`
      SELECT
        "id",
        "buyoutId",
        "clientEmail",
        "subject",
        "snippet",
        "receivedAt",
        "respondedAt",
        "isRead"
      FROM "InboxAlert"
      WHERE "isDismissed" = FALSE
        AND "respondedAt" IS NULL
      ORDER BY "receivedAt" DESC
      LIMIT 50
    `) as Array<{
      id: string;
      buyoutId: string;
      clientEmail: string;
      subject: string;
      snippet: string;
      receivedAt: Date;
      respondedAt: Date | null;
      isRead: boolean;
    }>;

    const alerts: InboxAlertRecord[] = rows.map((row) => ({
      id: row.id,
      buyoutId: row.buyoutId,
      clientEmail: row.clientEmail,
      subject: row.subject,
      snippet: row.snippet,
      receivedAt: row.receivedAt.toISOString(),
      respondedAt: row.respondedAt?.toISOString() ?? null,
      isRead: row.isRead,
      hoursWaiting: Math.floor((Date.now() - row.receivedAt.getTime()) / 3600000)
    }));

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
    const body = (await request.json()) as { ids?: string[]; action?: "dismiss" };
    const ids = body.ids;
    if (!ids || ids.length === 0) {
      return NextResponse.json({ ok: false, error: "No alert IDs provided" }, { status: 400 });
    }

    await prisma.inboxAlert.updateMany({
      where: { id: { in: ids } },
      data: { isDismissed: true },
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
