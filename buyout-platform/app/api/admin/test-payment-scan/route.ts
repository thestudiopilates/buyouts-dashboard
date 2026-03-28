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
      const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: process.env.GMAIL_CLIENT_ID!,
          client_secret: process.env.GMAIL_CLIENT_SECRET!,
          refresh_token: process.env.GMAIL_REFRESH_TOKEN!,
          grant_type: "refresh_token"
        })
      });

      const tokenData = (await tokenResponse.json()) as { access_token?: string; error?: string; error_description?: string };

      if (!tokenData.access_token) {
        return NextResponse.json({
          error: "Token refresh failed",
          tokenError: tokenData.error,
          tokenErrorDescription: tokenData.error_description
        });
      }

      const userId = process.env.GMAIL_USER_ID || "me";
      const listUrl = new URL(`https://gmail.googleapis.com/gmail/v1/users/${encodeURIComponent(userId)}/messages`);
      listUrl.searchParams.set("q", customQuery);
      listUrl.searchParams.set("maxResults", "10");
      listUrl.searchParams.set("includeSpamTrash", "true");

      const listResponse = await fetch(listUrl.toString(), {
        headers: { Authorization: `Bearer ${tokenData.access_token}` }
      });

      const responseText = await listResponse.text();
      let listData: Record<string, unknown> = {};
      try { listData = JSON.parse(responseText); } catch { listData = { raw: responseText.slice(0, 500) }; }

      return NextResponse.json({
        query: customQuery,
        status: listResponse.status,
        userId,
        senderEmail: process.env.GMAIL_SENDER_EMAIL,
        hasRefreshToken: Boolean(process.env.GMAIL_REFRESH_TOKEN),
        tokenScopes: tokenData.access_token ? "present" : "missing",
        response: listData
      });
    }

    const payments = await searchPaymentEmails(30);
    return NextResponse.json({
      found: payments.length,
      payments: payments.map((p) => ({
        orderNumber: p.orderNumber,
        clientName: p.clientName,
        clientEmail: p.clientEmail,
        amount: p.amount,
        paymentMethod: p.paymentMethod,
        productName: p.productName,
        date: p.date,
        gmailMessageId: p.gmailMessageId,
        bodyPreview: p.bodyText.slice(0, 200)
      }))
    });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
}
