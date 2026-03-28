import { NextResponse } from "next/server";

import { getBuyout } from "@/lib/buyouts";
import { getEmailHistory, getGmailReadiness } from "@/lib/gmail";

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

    const gmail = getGmailReadiness();
    if (!gmail.ready) {
      return NextResponse.json({ sent: [], received: [], all: [], gmailReady: false });
    }

    const clientEmail = buyout.clientEmail;
    if (!clientEmail) {
      return NextResponse.json({ sent: [], received: [], all: [], gmailReady: true });
    }

    const all = await getEmailHistory(clientEmail);
    const sent = all.filter((m) => m.direction === "sent");
    const received = all.filter((m) => m.direction === "received");

    return NextResponse.json({ sent, received, all, gmailReady: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load email history.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
