import { NextResponse } from "next/server";

import { updateEmailTemplate } from "@/lib/email-templates";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ key: string }> }
) {
  const { key } = await context.params;
  const body = (await request.json()) as {
    subjectTemplate?: unknown;
    bodyTemplate?: unknown;
  };

  if (typeof body.subjectTemplate !== "string" || typeof body.bodyTemplate !== "string") {
    return NextResponse.json(
      { error: "subjectTemplate and bodyTemplate are required." },
      { status: 400 }
    );
  }

  try {
    const template = await updateEmailTemplate(key, {
      subjectTemplate: body.subjectTemplate,
      bodyTemplate: body.bodyTemplate
    });

    return NextResponse.json({ template });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to update template.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
