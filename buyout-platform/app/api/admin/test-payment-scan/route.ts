import { NextResponse } from "next/server";

import { getGmailReadiness, searchPaymentEmails } from "@/lib/gmail";

export async function GET(request: Request) {
  const gmail = getGmailReadiness();
  if (!gmail.ready) {
    return NextResponse.json({ error: "Gmail not configured", gmail });
  }

  const { searchParams } = new URL(request.url);
  const customQuery = searchParams.get("q");

  try {
    if (customQuery) {
      const config = {
        clientId: process.env.GMAIL_CLIENT_ID!,
        clientSecret: process.env.GMAIL_CLIENT_SECRET!,
        refreshToken: process.env.GMAIL_REFRESH_TOKEN!
      };

      const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: config.clientId,
          client_secret: config.clientSecret,
          refresh_token: config.refreshToken,
          grant_type: "refresh_token"
        })
      });

      const tokenData = (await tokenResponse.json()) as { access_token?: string };
      const accessToken = tokenData.access_token;

      if (!accessToken) {
        return NextResponse.json({ error: "No access token" });
      }

      const userId = process.env.GMAIL_USER_ID || "me";
      const listUrl = new URL(`https://gmail.googleapis.com/gmail/v1/users/${encodeURIComponent(userId)}/messages`);
      listUrl.searchParams.set("q", customQuery);
      listUrl.searchParams.set("maxResults", "10");

      const listResponse = await fetch(listUrl.toString(), {
        headers: { Authorization: `Bearer ${accessToken}` }
      });

      const listData = await listResponse.json();

      return NextResponse.json({
        query: customQuery,
        status: listResponse.status,
        resultSizeEstimate: listData.resultSizeEstimate ?? 0,
        messageCount: listData.messages?.length ?? 0,
        messages: (listData.messages ?? []).slice(0, 5).map((m: { id: string }) => m.id)
      });
    }

    const payments = await searchPaymentEmails(30);
    return NextResponse.json({
      found: payments.length,
      payments: payments.map((p) => ({
        orderNumber: p.orderNumber,
        clientName: p.clientName,
        amount: p.amount,
        paymentMethod: p.paymentMethod,
        date: p.date,
        gmailMessageId: p.gmailMessageId
      }))
    });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
}
