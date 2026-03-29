import { NextResponse } from "next/server";

import { getBuyout } from "@/lib/buyouts";
import { getMomenceClassByUrl } from "@/lib/momence";

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

    if (!buyout.signupLink) {
      return NextResponse.json({ classInfo: null, message: "No signup link set for this buyout." });
    }

    const classInfo = await getMomenceClassByUrl(buyout.signupLink);

    return NextResponse.json({ classInfo });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to fetch Momence data.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
