import { NextResponse } from "next/server";

import { updateBuyout } from "@/lib/buyouts";
import { buyoutUpdateSchema, type BuyoutUpdateFormState } from "@/lib/validations";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const body = (await request.json()) as Record<string, unknown>;

  const parsed = buyoutUpdateSchema.safeParse(body);

  if (!parsed.success) {
    const response: BuyoutUpdateFormState = {
      status: "error",
      message: "Please correct the highlighted fields and try again.",
      errors: parsed.error.flatten().fieldErrors
    };

    return NextResponse.json(response, { status: 400 });
  }

  try {
    const buyout = await updateBuyout(id, parsed.data);
    return NextResponse.json({
      status: "success",
      message: "Buyout details updated.",
      buyout
    } satisfies BuyoutUpdateFormState & { buyout: unknown });
  } catch (error) {
    return NextResponse.json(
      {
        status: "error",
        message: error instanceof Error ? error.message : "Unable to update buyout."
      } satisfies BuyoutUpdateFormState,
      { status: 500 }
    );
  }
}
