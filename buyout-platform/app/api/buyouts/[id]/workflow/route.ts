import { NextResponse } from "next/server";

import { toggleWorkflowStep } from "@/lib/buyouts";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const body = (await request.json().catch(() => ({}))) as {
    stepKey?: string;
    isComplete?: boolean;
  };

  if (typeof body.stepKey !== "string") {
    return NextResponse.json({ error: "stepKey is required." }, { status: 400 });
  }

  try {
    const buyout = await toggleWorkflowStep(id, body.stepKey, body.isComplete ?? true);
    return NextResponse.json({ buyout });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to update workflow step.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
