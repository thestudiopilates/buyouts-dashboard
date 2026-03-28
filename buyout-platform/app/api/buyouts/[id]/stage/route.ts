import { NextResponse } from "next/server";

import { setManualStage } from "@/lib/buyouts";
import type { StageKey } from "@/lib/types";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const body = (await request.json().catch(() => ({}))) as { stage?: string };

  if (typeof body.stage !== "string") {
    return NextResponse.json({ error: "stage is required." }, { status: 400 });
  }

  try {
    const buyout = await setManualStage(id, body.stage as StageKey);
    return NextResponse.json({ buyout });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to update stage.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
