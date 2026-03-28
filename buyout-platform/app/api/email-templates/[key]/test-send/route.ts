import { NextResponse } from "next/server";

import { executeTemplateReviewSend } from "@/lib/email-actions";

export async function POST(
  request: Request,
  context: { params: Promise<{ key: string }> }
) {
  const { key } = await context.params;
  const body = (await request.json().catch(() => ({}))) as { buyoutId?: string };

  try {
    const result = await executeTemplateReviewSend({ templateKey: key, buyoutId: body.buyoutId });
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to run the internal review send.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
