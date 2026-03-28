import { z } from "zod";

const optionalText = z.preprocess((value) => {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}, z.string().optional());

const optionalPositiveInteger = z.preprocess((value) => {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  return Number(trimmed);
}, z.number().int().positive().optional());

export const inquirySchema = z.object({
  clientName: z.string().min(2, "Client name is required."),
  clientEmail: z.string().email("Enter a valid email address."),
  clientPhone: optionalText,
  companyName: optionalText,
  eventType: optionalText,
  preferredDates: optionalText,
  preferredLocation: optionalText,
  guestCountEstimate: optionalPositiveInteger,
  notes: optionalText
});

export type InquiryFormState = {
  status: "idle" | "success" | "error";
  message?: string;
  errors?: Record<string, string[] | undefined>;
};

export const buyoutUpdateSchema = z.object({
  clientName: z.string().min(2, "Client name is required."),
  clientEmail: z.string().email("Enter a valid email address."),
  clientPhone: optionalText,
  eventType: optionalText,
  eventDate: optionalText,
  startTime: optionalText,
  endTime: optionalText,
  location: optionalText,
  assignedTo: optionalText,
  instructor: optionalText,
  nextAction: optionalText,
  notes: optionalText,
  depositLink: optionalText,
  balanceLink: optionalText,
  signupLink: optionalText
});

export type BuyoutUpdateFormState = {
  status: "idle" | "success" | "error";
  message?: string;
  errors?: Record<string, string[] | undefined>;
};
