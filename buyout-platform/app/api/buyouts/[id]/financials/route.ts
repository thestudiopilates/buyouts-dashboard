import { NextResponse } from "next/server";

import { hasDatabaseUrl } from "@/lib/prisma";
import { updateBuyoutFinancialsInDb } from "@/lib/repositories/buyouts";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;

  if (!hasDatabaseUrl()) {
    return NextResponse.json({ error: "Database required." }, { status: 503 });
  }

  try {
    const body = (await request.json()) as {
      total?: number;
      depositAmount?: number;
      paymentStructure?: "deposit-balance" | "standard" | "rush" | "custom";
    };

    const total = body.total !== undefined ? Number(body.total) : undefined;
    const depositAmount = body.depositAmount !== undefined ? Number(body.depositAmount) : undefined;

    if (total !== undefined && (isNaN(total) || total < 0)) {
      return NextResponse.json({ error: "Total must be a non-negative number." }, { status: 400 });
    }
    if (depositAmount !== undefined && (isNaN(depositAmount) || depositAmount < 0)) {
      return NextResponse.json({ error: "Deposit amount must be a non-negative number." }, { status: 400 });
    }

    await updateBuyoutFinancialsInDb(id, {
      total,
      depositAmount,
      paymentStructure: body.paymentStructure
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to update financials.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
