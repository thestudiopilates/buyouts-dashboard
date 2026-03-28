import { NextResponse } from "next/server";

import { listEmailActivity } from "@/lib/email-templates";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;

  try {
    const activity = await listEmailActivity(id);
    return NextResponse.json({ activity });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load activity.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
