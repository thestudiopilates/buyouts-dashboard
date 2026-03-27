import { NextResponse } from "next/server";

import { createInquiry } from "@/lib/buyouts";
import { inquirySchema, type InquiryFormState } from "@/lib/validations";

export async function POST(request: Request) {
  const formData = await request.formData();
  const payload = {
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

  const parsed = inquirySchema.safeParse(payload);

  if (!parsed.success) {
    const response: InquiryFormState = {
      status: "error",
      message: "Please correct the highlighted fields and try again.",
      errors: parsed.error.flatten().fieldErrors
    };

    return NextResponse.json(response, { status: 400 });
  }

  await createInquiry(parsed.data);

  const response: InquiryFormState = {
    status: "success",
    message: "Inquiry received. The management team can now review it in the dashboard."
  };

  return NextResponse.json(response);
}
