import { MondayImportRecord, MondayItem } from "@/lib/monday-types";

const COLUMN_IDS = {
  eventDetails: "long_texth99wlmi8",
  internalNotes: "long_text_mm1vj480",
  clientEmail: "emailoeuk5uwf",
  nextAction: "color_mkzj2yse",
  emailTrigger: "color_mkzjmcth",
  eventType: "color_mkzjpp7j",
  rushRequest: "color_mkzjwwcf",
  stage: "color_mkzgwzg9",
  tracking: "color_mkzg4hne",
  ccEmails: "text_mm1tnygh",
  preferredDate1: "date_mkzgxvy2",
  preferredDate2: "datex1qbi6on",
  recommendedDate: "date_mkzjxc1t",
  finalizedDate: "date_mkzjkm1t",
  startTime: "hour_mm0rahy6",
  endTime: "hour_mm0rrxfq",
  totalMinutes: "numeric_mkzj6seb",
  preferredLocation: "dropdown_mkzgaf3g",
  finalLocation: "dropdown_mkzjkhds",
  paymentStatus: "color_mkzgvmxg",
  capacity: "numeric_mkzgwpay",
  signupCount: "numeric_mkzgbp8m",
  deskConfirmed: "color_mkzgyn00",
  deskStaff: "text_mkzj98wp",
  preferredInstructor: "short_text3hyk6jn8",
  clientQuestions: "long_textjgw42nuj",
  clientPhone: "phone0kwsc7vn",
  claimed: "color_mkzgz71q",
  instructor: "text_mkzg27y9",
  lastTspAction: "date_mm1vya30",
  ballInCourt: "color_mm1vd046",
  totalPrice: "numeric_mkzj1sfj",
  amountPaid: "numeric_mm1v48qj",
  depositAmount: "numeric_mm1v472d",
  remainingBalance: "formula_mm1v17wd",
  depositLink: "link_mkzjmvqw",
  balanceLink: "link_mkzjsm8r",
  signupLink: "link_mkzg7k99",
  emailThreadId: "text_mm1ttgb7",
  emailMessageId: "text_mm1t1dgy",
  t1: "long_text_mkzjxtpp",
  t2: "long_text_mkzjd66k",
  t3: "long_text_mkzjwxsh",
  t4: "long_text_mkzjpmj",
  t5: "long_text_mkzjfbe9",
  t6: "long_text_mkzj7sj5",
  t7: "long_text_mkzjemea",
  t8: "long_text_mkzj2qt0",
  t9: "long_text_mkzj6xcc",
  t10: "long_text_mkzj45br",
  t11: "long_text_mkzj6cy5",
  t12: "long_text_mkzjab4d",
  t13: "long_text_mkzj14vc",
  t14: "long_text_mkzjw24h"
} as const;

const STATUS_TO_STAGE: Record<string, MondayImportRecord["lifecycleStage"]> = {
  "New Inquiry": "INQUIRY",
  "New Inquiry Received": "INQUIRY",
  "Still Discussing Dates / Times": "DISCUSS",
  "Initial Response Sent": "RESPOND",
  "Follow Up Sent": "DISCUSS",
  "Date Agreement Reached": "FEASIBLE",
  "Feasibility Confirmed": "FEASIBLE",
  "Quote Sent": "QUOTE",
  "Waiting on 1st Payment": "DEPOSIT",
  "Deposit Received": "DEPOSIT",
  "Payment Complete": "PAID",
  "Waiting on Sign Ups": "SIGNUPS",
  "Awaiting Guest Sign-Ups": "SIGNUPS",
  "Sign ups Complete": "CONFIRMED",
  "Sign-Ups Complete": "CONFIRMED",
  "Final Confirmation Sent": "FINAL",
  "Ready for Event": "READY",
  "Event Complete": "COMPLETE",
  "Not Possible": "CANCELLED",
  "Event Not Possible": "CANCELLED",
  "Cancelled": "CANCELLED",
  "Event Cancelled (No Refund)": "CANCELLED",
  "Event Cancelled (Refund)": "CANCELLED"
};

const TRACKING_TO_HEALTH: Record<string, MondayImportRecord["trackingHealth"]> = {
  "So far so good": "ON_TRACK",
  "Running behind": "AT_RISK",
  "Major issue": "MAJOR_ISSUE",
  "Complete": "COMPLETE"
};

const BALL_TO_ENUM: Record<string, MondayImportRecord["ballInCourt"]> = {
  "TSP Team": "TEAM",
  Client: "CLIENT",
  Both: "BOTH"
};

export const WORKFLOW_IMPORT_KEYS = [
  "inquiryReviewed",
  "initialInquiryResponseSent",
  "customerResponded",
  "dateFinalized",
  "depositLinkSentAndTermsShared",
  "depositPaidAndTermsSigned",
  "instructorFinalized",
  "momenceClassCreated",
  "momenceLinkSent",
  "remainingPaymentReceived",
  "allAttendeesRegistered",
  "allWaiversSigned",
  "frontDeskAssigned",
  "frontDeskShiftExtended",
  "finalConfirmationSent",
  "eventCompleted"
] as const;

function getTextValue(item: MondayItem, columnId: string) {
  const value = item.column_values.find((column) => column.id === columnId);
  return value?.text?.trim() ?? "";
}

function getNumericValue(item: MondayItem, columnId: string) {
  const text = getTextValue(item, columnId);
  if (!text) {
    return undefined;
  }

  const sanitized = text.replace(/[^0-9.-]/g, "");
  const parsed = Number(sanitized);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function pickTemplateBodies(item: MondayItem) {
  return Object.fromEntries(
    Object.entries(COLUMN_IDS)
      .filter(([key]) => key.startsWith("t"))
      .map(([key, columnId]) => [key, getTextValue(item, columnId)])
      .filter(([, value]) => value.length > 0)
  );
}

export function mapMondayItemToImportRecord(item: MondayItem): MondayImportRecord {
  const statusLabel = getTextValue(item, COLUMN_IDS.stage);
  const trackingLabel = getTextValue(item, COLUMN_IDS.tracking);
  const ballInCourtLabel = getTextValue(item, COLUMN_IDS.ballInCourt);
  const preferredDates = [
    getTextValue(item, COLUMN_IDS.preferredDate1),
    getTextValue(item, COLUMN_IDS.preferredDate2),
    getTextValue(item, COLUMN_IDS.recommendedDate)
  ]
    .filter(Boolean)
    .join(" / ");

  return {
    legacyMondayItemId: item.id,
    displayName: item.name,
    clientName: item.name,
    clientEmail: getTextValue(item, COLUMN_IDS.clientEmail) || undefined,
    ccEmails: getTextValue(item, COLUMN_IDS.ccEmails) || undefined,
    preferredDates: preferredDates || undefined,
    preferredLocation: getTextValue(item, COLUMN_IDS.preferredLocation) || undefined,
    finalLocation: getTextValue(item, COLUMN_IDS.finalLocation) || undefined,
    eventDate: getTextValue(item, COLUMN_IDS.finalizedDate) || undefined,
    startTime: getTextValue(item, COLUMN_IDS.startTime) || undefined,
    endTime: getTextValue(item, COLUMN_IDS.endTime) || undefined,
    instructorName: getTextValue(item, COLUMN_IDS.instructor) || undefined,
    lifecycleStage: STATUS_TO_STAGE[statusLabel] ?? "INQUIRY",
    trackingHealth: TRACKING_TO_HEALTH[trackingLabel] ?? "ON_TRACK",
    ballInCourt: BALL_TO_ENUM[ballInCourtLabel] ?? "TEAM",
    nextAction: getTextValue(item, COLUMN_IDS.nextAction) || undefined,
    totalPrice: getNumericValue(item, COLUMN_IDS.totalPrice),
    amountPaid: getNumericValue(item, COLUMN_IDS.amountPaid),
    depositAmount: getNumericValue(item, COLUMN_IDS.depositAmount),
    remainingBalance: getNumericValue(item, COLUMN_IDS.remainingBalance),
    depositLink: getTextValue(item, COLUMN_IDS.depositLink) || undefined,
    balanceLink: getTextValue(item, COLUMN_IDS.balanceLink) || undefined,
    signupLink: getTextValue(item, COLUMN_IDS.signupLink) || undefined,
    emailThreadId: getTextValue(item, COLUMN_IDS.emailThreadId) || undefined,
    emailMessageId: getTextValue(item, COLUMN_IDS.emailMessageId) || undefined,
    notes: undefined,
    templateBodies: pickTemplateBodies(item),
    workflowStepKeys: []
  };
}

export const MONDAY_IMPORT_NOTES = {
  unresolvedColumns: [
    "notes are still condensed into app-friendly fields rather than mirrored 1:1",
    "email trigger history is not yet normalized into BuyoutEmail rows"
  ],
  knownLimitations: [
    "Workflow state can now be imported from the real 16 Monday status columns.",
    "The dashboard still summarizes some imported fields instead of showing every Monday column directly.",
    "t13 should not be treated as a clean email template because it was also used as a conversation log."
  ]
};
