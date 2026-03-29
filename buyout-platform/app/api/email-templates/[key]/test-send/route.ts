import { NextResponse } from "next/server";

import { executeTemplateReviewSend } from "@/lib/email-actions";

export async function POST(
  request: Request,
  context: { params: Promise<{ key: string }> }
) {
  const { key } = await context.params;
  const body = (await request.json().catch(() => ({}))) as {
    buyoutId?: string;
    subjectOverride?: string;
    bodyOverride?: string;
    cc?: string;
    sendToClient?: boolean;
  };

  try {
    const result = await executeTemplateReviewSend({
      templateKey: key,
      buyoutId: body.buyoutId,
      subjectOverride: body.subjectOverride,
      bodyOverride: body.bodyOverride,
      cc: body.cc,
      sendToClient: body.sendToClient
    });
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to send.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
