import { NextResponse } from "next/server";

import { getBuyout } from "@/lib/buyouts";
import { hasDatabaseUrl, prisma } from "@/lib/prisma";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;

  try {
    const buyout = await getBuyout(id);
    if (!buyout) {
      return NextResponse.json({ error: "Buyout not found." }, { status: 404 });
    }

    type EmailItem = {
      id: string;
      date: string;
      from: string;
      to: string;
      subject: string;
      snippet: string;
      bodyText?: string;
      direction: string;
      source: string;
    };

    const items: EmailItem[] = [];

    // Read from BuyoutEmail (platform sends)
    if (hasDatabaseUrl()) {
      const dbEmails = await prisma.buyoutEmail.findMany({
        where: { buyoutId: id },
        orderBy: { sentAt: "desc" }
      });

      for (const email of dbEmails) {
        if (email.sentAt) {
          items.push({
            id: `db_${email.id}`,
            date: email.sentAt.toISOString(),
            from: email.sentBy ?? "events@thestudiopilates.com",
            to: buyout.clientEmail,
            subject: email.subject,
            snippet: (email.bodyText ?? "").slice(0, 160),
            bodyText: email.bodyText ?? undefined,
            direction: "sent",
            source: "platform"
          });
        }
      }

      // Read from StoredEmail (backfilled Gmail history)
      try {
        const stored = await prisma.$queryRawUnsafe(
          `SELECT "id","direction","fromAddress","toAddress","subject","snippet","bodyText","sentAt","source"
           FROM "StoredEmail"
           WHERE "buyoutId" = $1
           ORDER BY "sentAt" DESC
           LIMIT 100`,
          id
        ) as Array<{
          id: string;
          direction: string;
          fromAddress: string;
          toAddress: string;
          subject: string;
          snippet: string;
          bodyText?: string;
          sentAt: Date;
          source: string;
        }>;

        for (const row of stored) {
          const isDup = items.some((i) => i.subject === row.subject && Math.abs(new Date(i.date).getTime() - row.sentAt.getTime()) < 300000);
          if (isDup) continue;

          items.push({
            id: `stored_${row.id}`,
            date: row.sentAt.toISOString(),
            from: row.fromAddress,
            to: row.toAddress,
            subject: row.subject ?? "",
            snippet: row.snippet ?? "",
            bodyText: row.bodyText ?? undefined,
            direction: row.direction,
            source: row.source
          });
        }
      } catch {
        // StoredEmail table might not exist yet — that's fine
      }
    }

    items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return NextResponse.json({
      sent: items.filter((m) => m.direction === "sent"),
      received: items.filter((m) => m.direction === "received"),
      all: items,
      gmailReady: true
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load email history.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
