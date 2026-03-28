import { NextResponse } from "next/server";

import { renderEmailHtml } from "@/lib/email-renderer";
import { getEmailTemplateByKey, previewEmailTemplate, updateEmailTemplate } from "@/lib/email-templates";
import { listBuyouts } from "@/lib/buyouts";

export async function GET(
  request: Request,
  context: { params: Promise<{ key: string }> }
) {
  const { key } = await context.params;
  const { searchParams } = new URL(request.url);
  const buyoutId = searchParams.get("buyoutId");

  try {
    const template = await getEmailTemplateByKey(key);
    if (!template) {
      return NextResponse.json({ error: "Template not found." }, { status: 404 });
    }

    const buyouts = await listBuyouts();
    const buyout = buyoutId ? buyouts.find((b) => b.id === buyoutId) ?? null : null;
    const preview = previewEmailTemplate(template, buyout);

    return NextResponse.json({ template, preview });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load template.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ key: string }> }
) {
  const { key } = await context.params;
  const body = (await request.json().catch(() => ({}))) as {
    subject?: string;
    body?: string;
    previewLabel?: string;
  };

  if (typeof body.subject !== "string" || typeof body.body !== "string") {
    return NextResponse.json({ error: "subject and body are required." }, { status: 400 });
  }

  const html = renderEmailHtml({
    subject: body.subject,
    body: body.body,
    previewLabel: body.previewLabel
  });

  return NextResponse.json({ html });
}

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
