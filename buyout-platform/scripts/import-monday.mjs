import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

import {
  BallInCourt,
  BuyoutStage,
  InquiryStatus,
  PrismaClient,
  TrackingHealth,
  WorkflowGroup
} from "@prisma/client";

const prisma = new PrismaClient();

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
  signupLink: "link_mkzg7k99",
  depositLink: "link_mkzjmvqw",
  balanceLink: "link_mkzjsm8r",
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
  ccEmails: "text_mm1tnygh",
  emailMessageId: "text_mm1t1dgy",
  emailThreadId: "text_mm1ttgb7",
  clientEmailsSent: "long_text_mkzj14vc",
  clientMessagesReceived: "long_text_mkzjs01j"
};

const STATUS_TO_STAGE = {
  "New Inquiry": BuyoutStage.INQUIRY,
  "New Inquiry Received": BuyoutStage.INQUIRY,
  "Still Discussing Dates / Times": BuyoutStage.DISCUSS,
  "Initial Response Sent": BuyoutStage.RESPOND,
  "Follow Up Sent": BuyoutStage.DISCUSS,
  "Date Agreement Reached": BuyoutStage.FEASIBLE,
  "Feasibility Confirmed": BuyoutStage.FEASIBLE,
  "Quote Sent": BuyoutStage.QUOTE,
  "Waiting on 1st Payment": BuyoutStage.DEPOSIT,
  "Deposit Received": BuyoutStage.DEPOSIT,
  "Payment Complete": BuyoutStage.PAID,
  "Waiting on Sign Ups": BuyoutStage.SIGNUPS,
  "Awaiting Guest Sign-Ups": BuyoutStage.SIGNUPS,
  "Sign ups Complete": BuyoutStage.CONFIRMED,
  "Sign-Ups Complete": BuyoutStage.CONFIRMED,
  "Final Confirmation Sent": BuyoutStage.FINAL,
  "Ready for Event": BuyoutStage.READY,
  "Event Complete": BuyoutStage.COMPLETE,
  "Not Possible": BuyoutStage.CANCELLED,
  "Event Not Possible": BuyoutStage.CANCELLED,
  Cancelled: BuyoutStage.CANCELLED,
  "Event Cancelled (No Refund)": BuyoutStage.CANCELLED,
  "Event Cancelled (Refund)": BuyoutStage.CANCELLED
};

const TRACKING_TO_HEALTH = {
  "So far so good": TrackingHealth.ON_TRACK,
  "Running behind": TrackingHealth.AT_RISK,
  "Major issue": TrackingHealth.MAJOR_ISSUE,
  Complete: TrackingHealth.COMPLETE
};

const BALL_TO_ENUM = {
  "TSP Team": BallInCourt.TEAM,
  Client: BallInCourt.CLIENT,
  Both: BallInCourt.BOTH
};

const WORKFLOW_DEFINITIONS = [
  { columnId: "color_mkzjyspd", stepKey: "inquiry-reviewed", label: "Inquiry Reviewed", group: WorkflowGroup.INTAKE },
  { columnId: "color_mkzjzzeq", stepKey: "initial-inquiry-response-sent", label: "Initial Inquiry Response Sent", group: WorkflowGroup.INTAKE },
  { columnId: "color_mkzjjfzw", stepKey: "customer-responded", label: "Customer Responded", group: WorkflowGroup.INTAKE },
  { columnId: "color_mkzj38f4", stepKey: "date-finalized", label: "Date Finalized", group: WorkflowGroup.PLANNING },
  { columnId: "color_mkzj7n47", stepKey: "deposit-link-sent-and-terms-shared", label: "Deposit Link Sent and Buyout Terms Agreement", group: WorkflowGroup.PAYMENT },
  { columnId: "color_mkzj1xfp", stepKey: "deposit-paid-and-terms-signed", label: "Buyout Deposit Paid and Terms Signed", group: WorkflowGroup.PAYMENT },
  { columnId: "color_mkzja39a", stepKey: "instructor-finalized", label: "Instructor Finalized", group: WorkflowGroup.LOGISTICS },
  { columnId: "color_mkzj73kt", stepKey: "momence-class-created", label: "Momence Class Created", group: WorkflowGroup.LOGISTICS },
  { columnId: "color_mkzj828m", stepKey: "momence-link-sign-up-sent", label: "Momence Link Sign Up Sent with Deadline for Signups", group: WorkflowGroup.LOGISTICS },
  { columnId: "color_mkzjbj7", stepKey: "remaining-payment-received", label: "Remaining Payment Received", group: WorkflowGroup.PAYMENT },
  { columnId: "color_mkzje20f", stepKey: "all-attendees-registered", label: "All Attendees Registered", group: WorkflowGroup.LOGISTICS },
  { columnId: "color_mkzjs2p", stepKey: "all-waivers-signed", label: "All Waivers Signed", group: WorkflowGroup.LOGISTICS },
  { columnId: "color_mkzjf1z7", stepKey: "front-desk-assigned", label: "Front Desk Team Member Assigned", group: WorkflowGroup.LOGISTICS },
  { columnId: "color_mkzjat4t", stepKey: "front-desk-shift-extended", label: "Front Desk Shift Extended Connect Team", group: WorkflowGroup.PRE_EVENT },
  { columnId: "color_mkzjs2s6", stepKey: "final-confirmation-emails-sent", label: "Final Confirmation Emails Sent Out", group: WorkflowGroup.PRE_EVENT },
  { columnId: "color_mkzjdr77", stepKey: "event-completed", label: "Event Completed", group: WorkflowGroup.EXECUTION }
];

function getColumn(item, columnId) {
  return item.column_values.find((column) => column.id === columnId);
}

function getTextValue(item, columnId) {
  return getColumn(item, columnId)?.text?.trim() ?? "";
}

function getNumericValue(item, columnId) {
  const text = getTextValue(item, columnId);
  if (!text) return undefined;
  const parsed = Number(text.replace(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : undefined;
}

function getBooleanStatus(item, columnId) {
  return getTextValue(item, columnId).toLowerCase() === "yes";
}

function getDateValue(item, columnId) {
  const text = getTextValue(item, columnId);
  if (!text) return null;

  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(text) ? `${text}T12:00:00.000Z` : text;
  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function slugify(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

function buildNotes(item) {
  const sections = [
    ["Internal Notes", getTextValue(item, COLUMN_IDS.internalNotes)],
    ["Event Details", getTextValue(item, COLUMN_IDS.eventDetails)],
    ["Client Questions", getTextValue(item, COLUMN_IDS.clientQuestions)],
    ["Client Emails Sent", getTextValue(item, COLUMN_IDS.clientEmailsSent)],
    ["Client Messages Received", getTextValue(item, COLUMN_IDS.clientMessagesReceived)]
  ].filter(([, value]) => value);

  return sections.map(([label, value]) => `${label}:\n${value}`).join("\n\n");
}

function getPreferredDates(item) {
  return [
    getTextValue(item, COLUMN_IDS.preferredDate1),
    getTextValue(item, COLUMN_IDS.preferredDate2),
    getTextValue(item, COLUMN_IDS.recommendedDate)
  ]
    .filter(Boolean)
    .join(" / ");
}

function getInquiryStatus(stage) {
  if (stage === BuyoutStage.COMPLETE || stage === BuyoutStage.CANCELLED) {
    return InquiryStatus.CLOSED;
  }

  if (stage === BuyoutStage.INQUIRY) {
    return InquiryStatus.NEW;
  }

  return InquiryStatus.CONVERTED;
}

async function main() {
  const inputPath = process.argv[2];
  if (!inputPath) {
    throw new Error("Usage: npm run import:monday -- ./path/to/monday-export.json");
  }

  const absolutePath = path.resolve(process.cwd(), inputPath);
  const raw = await fs.readFile(absolutePath, "utf8");
  const data = JSON.parse(raw);

  if (!Array.isArray(data.items)) {
    throw new Error("Expected JSON with an items array.");
  }

  let imported = 0;

  for (const item of data.items) {
    const stageLabel = getTextValue(item, COLUMN_IDS.stage);
    const stage = STATUS_TO_STAGE[stageLabel] ?? BuyoutStage.INQUIRY;
    const locationName =
      getTextValue(item, COLUMN_IDS.finalLocation) || getTextValue(item, COLUMN_IDS.preferredLocation);
    const eventType = getTextValue(item, COLUMN_IDS.eventType) || null;
    const primaryEmail = getTextValue(item, COLUMN_IDS.clientEmail) || `monday-${item.id}@placeholder.local`;
    const primaryPhone = getTextValue(item, COLUMN_IDS.clientPhone) || null;
    const inquiryNotes = getTextValue(item, COLUMN_IDS.eventDetails) || null;
    const notesInternal = buildNotes(item) || null;
    const preferredDates = getPreferredDates(item) || null;
    const capacity = getNumericValue(item, COLUMN_IDS.capacity) ?? null;
    const signupCount = getNumericValue(item, COLUMN_IDS.signupCount) ?? 0;

    const location = locationName
      ? await prisma.location.upsert({
          where: { id: `loc_${slugify(locationName)}` },
          update: { name: locationName },
          create: {
            id: `loc_${slugify(locationName)}`,
            name: locationName
          }
        })
      : null;

    const inquiry = await prisma.buyoutInquiry.upsert({
      where: { legacyMondayItemId: item.id },
      update: {
        source: "monday-import",
        clientName: item.name,
        clientEmail: primaryEmail,
        clientPhone: primaryPhone,
        eventType,
        preferredDates,
        preferredLocation: getTextValue(item, COLUMN_IDS.preferredLocation) || null,
        guestCountEstimate: capacity,
        notes: inquiryNotes,
        status: getInquiryStatus(stage)
      },
      create: {
        legacyMondayItemId: item.id,
        source: "monday-import",
        clientName: item.name,
        clientEmail: primaryEmail,
        clientPhone: primaryPhone,
        eventType,
        preferredDates,
        preferredLocation: getTextValue(item, COLUMN_IDS.preferredLocation) || null,
        guestCountEstimate: capacity,
        notes: inquiryNotes,
        status: getInquiryStatus(stage)
      }
    });

    const buyout = await prisma.buyout.upsert({
      where: { legacyMondayItemId: item.id },
      update: {
        displayName: item.name,
        inquiryId: inquiry.id,
        lifecycleStage: stage,
        trackingHealth: TRACKING_TO_HEALTH[getTextValue(item, COLUMN_IDS.tracking)] ?? TrackingHealth.ON_TRACK,
        ballInCourt: BALL_TO_ENUM[getTextValue(item, COLUMN_IDS.ballInCourt)] ?? BallInCourt.TEAM,
        nextAction: getTextValue(item, COLUMN_IDS.nextAction) || null,
        notesInternal,
        eventDate: getDateValue(item, COLUMN_IDS.finalizedDate),
        startTime: getTextValue(item, COLUMN_IDS.startTime) || null,
        endTime: getTextValue(item, COLUMN_IDS.endTime) || null,
        instructorName: getTextValue(item, COLUMN_IDS.instructor) || getTextValue(item, COLUMN_IDS.preferredInstructor) || null,
        capacity,
        signupCount,
        lastActionAt: getDateValue(item, COLUMN_IDS.lastTspAction),
        locationId: location?.id ?? null
      },
      create: {
        legacyMondayItemId: item.id,
        displayName: item.name,
        inquiryId: inquiry.id,
        lifecycleStage: stage,
        trackingHealth: TRACKING_TO_HEALTH[getTextValue(item, COLUMN_IDS.tracking)] ?? TrackingHealth.ON_TRACK,
        ballInCourt: BALL_TO_ENUM[getTextValue(item, COLUMN_IDS.ballInCourt)] ?? BallInCourt.TEAM,
        nextAction: getTextValue(item, COLUMN_IDS.nextAction) || null,
        notesInternal,
        eventDate: getDateValue(item, COLUMN_IDS.finalizedDate),
        startTime: getTextValue(item, COLUMN_IDS.startTime) || null,
        endTime: getTextValue(item, COLUMN_IDS.endTime) || null,
        instructorName: getTextValue(item, COLUMN_IDS.instructor) || getTextValue(item, COLUMN_IDS.preferredInstructor) || null,
        capacity,
        signupCount,
        lastActionAt: getDateValue(item, COLUMN_IDS.lastTspAction),
        locationId: location?.id ?? null
      }
    });

    await prisma.buyoutFinancial.upsert({
      where: { buyoutId: buyout.id },
      update: {
        quotedTotal: getNumericValue(item, COLUMN_IDS.totalPrice) ?? null,
        depositAmount: getNumericValue(item, COLUMN_IDS.depositAmount) ?? null,
        amountPaid: getNumericValue(item, COLUMN_IDS.amountPaid) ?? 0,
        remainingBalance: getNumericValue(item, COLUMN_IDS.remainingBalance) ?? null,
        depositLink: getTextValue(item, COLUMN_IDS.depositLink) || null,
        balanceLink: getTextValue(item, COLUMN_IDS.balanceLink) || null
      },
      create: {
        buyoutId: buyout.id,
        quotedTotal: getNumericValue(item, COLUMN_IDS.totalPrice) ?? null,
        depositAmount: getNumericValue(item, COLUMN_IDS.depositAmount) ?? null,
        amountPaid: getNumericValue(item, COLUMN_IDS.amountPaid) ?? 0,
        remainingBalance: getNumericValue(item, COLUMN_IDS.remainingBalance) ?? null,
        depositLink: getTextValue(item, COLUMN_IDS.depositLink) || null,
        balanceLink: getTextValue(item, COLUMN_IDS.balanceLink) || null
      }
    });

    await prisma.buyoutContact.deleteMany({ where: { buyoutId: buyout.id } });

    await prisma.buyoutContact.create({
      data: {
        buyoutId: buyout.id,
        name: item.name,
        email: primaryEmail,
        phone: primaryPhone,
        role: "Client",
        isPrimary: true
      }
    });

    await prisma.buyoutWorkflowStep.deleteMany({ where: { buyoutId: buyout.id } });

    await prisma.buyoutWorkflowStep.createMany({
      data: WORKFLOW_DEFINITIONS.map((definition, index) => ({
        id: `${buyout.id}_${String(index + 1).padStart(2, "0")}`,
        buyoutId: buyout.id,
        stepKey: definition.stepKey,
        stepGroup: definition.group,
        label: definition.label,
        isComplete: getBooleanStatus(item, definition.columnId),
        completedAt: getBooleanStatus(item, definition.columnId) ? buyout.updatedAt : null
      }))
    });

    imported += 1;
  }

  console.log(`Imported ${imported} Monday items into Prisma.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
