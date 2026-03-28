import { NextResponse } from "next/server";

import { getGmailReadiness, searchPaymentEmails } from "@/lib/gmail";

export async function GET() {
  const gmail = getGmailReadiness();
  if (!gmail.ready) {
    return NextResponse.json({ error: "Gmail not configured", gmail });
  }

  try {
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
      error: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack?.slice(0, 500) : undefined
    });
  }
}
