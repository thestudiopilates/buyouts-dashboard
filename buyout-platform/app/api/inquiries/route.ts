import { NextResponse } from "next/server";

import { createInquiry } from "@/lib/buyouts";
import { inquirySchema, type InquiryFormState } from "@/lib/validations";

const ALLOWED_ORIGINS = [
  "https://thestudiopilates.com",
  "https://www.thestudiopilates.com",
  "http://thestudiopilates.local",
  "http://localhost:10003",
  "http://localhost:10004"
];

function corsHeaders(request: Request) {
  const origin = request.headers.get("origin") ?? "";
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];

  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  };
}

export async function OPTIONS(request: Request) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(request) });
}

export async function POST(request: Request) {
  const headers = corsHeaders(request);
  const contentType = request.headers.get("content-type") ?? "";

  let payload: Record<string, string>;

  if (contentType.includes("application/json")) {
    const body = (await request.json()) as Record<string, unknown>;
    payload = {
      clientName: String(body.clientName ?? ""),
      clientEmail: String(body.clientEmail ?? ""),
      clientPhone: String(body.clientPhone ?? ""),
      companyName: String(body.companyName ?? ""),
      eventType: String(body.eventType ?? ""),
      preferredDates: String(body.preferredDates ?? ""),
      preferredLocation: String(body.preferredLocation ?? ""),
      guestCountEstimate: String(body.guestCountEstimate ?? ""),
      notes: String(body.notes ?? "")
    };
  } else {
    const formData = await request.formData();
    payload = {
      clientName: String(formData.get("clientName") ?? ""),
      clientEmail: String(formData.get("clientEmail") ?? ""),
      clientPhone: String(formData.get("clientPhone") ?? ""),
      companyName: String(formData.get("companyName") ?? ""),
      eventType: String(formData.get("eventType") ?? ""),
      preferredDates: String(formData.get("preferredDates") ?? ""),
      preferredLocation: String(formData.get("preferredLocation") ?? ""),
      guestCountEstimate: String(formData.get("guestCountEstimate") ?? ""),
      notes: String(formData.get("notes") ?? "")
    };
  }

  const parsed = inquirySchema.safeParse(payload);

  if (!parsed.success) {
    const response: InquiryFormState = {
      status: "error",
      message: "Please correct the highlighted fields and try again.",
      errors: parsed.error.flatten().fieldErrors
    };

    return NextResponse.json(response, { status: 400, headers });
  }

  await createInquiry(parsed.data);

  const response: InquiryFormState = {
    status: "success",
    message: "Thank you! Your inquiry has been received. Our team will be in touch within 1-2 business days."
  };

  return NextResponse.json(response, { headers });
}
