import { NextResponse } from "next/server";

import { listPaymentActivity } from "@/lib/email-templates";

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
