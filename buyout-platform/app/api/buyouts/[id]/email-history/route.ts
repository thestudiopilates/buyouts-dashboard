import { NextResponse } from "next/server";

import { getBuyout } from "@/lib/buyouts";
import { getEmailHistory, getGmailReadiness } from "@/lib/gmail";
import { hasDatabaseUrl, prisma } from "@/lib/prisma";

type EmailHistoryItem = {
  id: string;
  date: string;
  from: string;
  to: string;
  subject: string;
  snippet: string;
  direction: "sent" | "received";
  source: "platform" | "gmail";
};

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

    const items: EmailHistoryItem[] = [];

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
            direction: "sent",
            source: "platform"
          });
        }
      }
    }

    const gmail = getGmailReadiness();
    if (gmail.ready && buyout.clientEmail) {
      try {
        const gmailMessages = await getEmailHistory(buyout.clientEmail);
        for (const msg of gmailMessages) {
          const isDuplicate = items.some(
            (existing) =>
              existing.subject === msg.subject &&
              Math.abs(new Date(existing.date).getTime() - new Date(msg.date).getTime()) < 300000
          );

          if (!isDuplicate) {
            items.push({
              id: `gmail_${msg.id}`,
              date: msg.date,
              from: msg.from,
              to: msg.to,
              subject: msg.subject,
              snippet: msg.snippet,
              direction: msg.direction,
              source: "gmail"
            });
          }
        }
      } catch {
        // Gmail fetch failed — continue with DB records only
      }
    }

    items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const sent = items.filter((m) => m.direction === "sent");
    const received = items.filter((m) => m.direction === "received");

    return NextResponse.json({ sent, received, all: items, gmailReady: gmail.ready });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load email history.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
