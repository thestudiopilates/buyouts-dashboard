import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

import { PrismaClient, BallInCourt, BuyoutStage, TrackingHealth, WorkflowGroup } from "@prisma/client";

const prisma = new PrismaClient();

function getTextValue(item, columnId) {
  const value = item.column_values.find((column) => column.id === columnId);
  return value?.text?.trim() ?? "";
}

function getNumericValue(item, columnId) {
  const text = getTextValue(item, columnId);
  if (!text) return undefined;
  const parsed = Number(text.replace(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : undefined;
}

const COLUMN_IDS = {
  clientEmail: "emailoeuk5uwf",
  ccEmails: "text_mm1tnygh",
  preferredDate1: "date_mkzgxvy2",
  finalizedDate: "date_mkzjkm1t",
  startTime: "hour_mm0rahy6",
  endTime: "hour_mm0rrxfq",
  preferredLocation: "dropdown_mkzgaf3g",
  finalLocation: "dropdown_mkzjkhds",
  instructor: "text_mkzg27y9",
  totalPrice: "numeric_mkzj1sfj",
  amountPaid: "numeric_mm1v48qj",
  depositAmount: "numeric_mm1v472d",
  remainingBalance: "formula_mm1v17wd",
  depositLink: "link_mkzjmvqw",
  balanceLink: "link_mkzjsm8r",
  signupLink: "link_mkzg7k99",
  tracking: "color_mkzjdr77",
  emailThreadId: "text_mm1ttgb7",
  emailMessageId: "text_mm1t1dgy"
};

const STATUS_TO_STAGE = {
  "New Inquiry Received": BuyoutStage.INQUIRY,
  "Initial Response Sent": BuyoutStage.RESPOND,
  "Follow Up Sent": BuyoutStage.DISCUSS,
  "Feasibility Confirmed": BuyoutStage.FEASIBLE,
  "Quote Sent": BuyoutStage.QUOTE,
  "Deposit Received": BuyoutStage.DEPOSIT,
  "Payment Complete": BuyoutStage.PAID,
  "Awaiting Guest Sign-Ups": BuyoutStage.SIGNUPS,
  "Sign-Ups Complete": BuyoutStage.CONFIRMED,
  "Final Confirmation Sent": BuyoutStage.FINAL,
  "Ready for Event": BuyoutStage.READY,
  "Event Complete": BuyoutStage.COMPLETE,
  "Cancelled": BuyoutStage.CANCELLED,
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

function slugify(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "_");
}

function deriveDefaultWorkflow(stage) {
  const stageToSteps = {
    [BuyoutStage.INQUIRY]: ["inquiry-reviewed"],
    [BuyoutStage.RESPOND]: ["inquiry-reviewed", "initial-response"],
    [BuyoutStage.DISCUSS]: ["inquiry-reviewed", "initial-response", "follow-up"],
    [BuyoutStage.FEASIBLE]: ["inquiry-reviewed", "initial-response", "follow-up", "feasibility"],
    [BuyoutStage.QUOTE]: ["inquiry-reviewed", "initial-response", "follow-up", "feasibility", "quote"],
    [BuyoutStage.DEPOSIT]: ["inquiry-reviewed", "initial-response", "follow-up", "feasibility", "quote", "deposit-requested", "deposit-received"],
    [BuyoutStage.PAID]: ["inquiry-reviewed", "initial-response", "follow-up", "feasibility", "quote", "deposit-requested", "deposit-received", "final-payment"],
    [BuyoutStage.SIGNUPS]: ["inquiry-reviewed", "initial-response", "follow-up", "feasibility", "quote", "deposit-requested", "deposit-received", "details-confirmed", "signup-link-created", "signup-link-sent"],
    [BuyoutStage.CONFIRMED]: ["inquiry-reviewed", "initial-response", "follow-up", "feasibility", "quote", "deposit-requested", "deposit-received", "details-confirmed", "signup-link-created", "signup-link-sent", "signups-monitored"],
    [BuyoutStage.FINAL]: ["inquiry-reviewed", "initial-response", "follow-up", "feasibility", "quote", "deposit-requested", "deposit-received", "details-confirmed", "signup-link-created", "signup-link-sent", "signups-monitored", "final-confirmation"],
    [BuyoutStage.READY]: ["inquiry-reviewed", "initial-response", "follow-up", "feasibility", "quote", "deposit-requested", "deposit-received", "details-confirmed", "signup-link-created", "signup-link-sent", "signups-monitored", "final-confirmation", "prep-complete"],
    [BuyoutStage.COMPLETE]: ["inquiry-reviewed", "initial-response", "follow-up", "feasibility", "quote", "deposit-requested", "deposit-received", "details-confirmed", "signup-link-created", "signup-link-sent", "signups-monitored", "final-confirmation", "prep-complete", "event-delivered", "follow-up-complete"],
    [BuyoutStage.CANCELLED]: ["inquiry-reviewed"]
  };

  return stageToSteps[stage] ?? ["inquiry-reviewed"];
}

const WORKFLOW_DEFINITIONS = {
  "inquiry-reviewed": { label: "Inquiry Reviewed", group: WorkflowGroup.INTAKE },
  "initial-response": { label: "Initial Response Sent", group: WorkflowGroup.INTAKE },
  "follow-up": { label: "Follow-Up Sent", group: WorkflowGroup.INTAKE },
  feasibility: { label: "Feasibility Confirmed", group: WorkflowGroup.PLANNING },
  quote: { label: "Quote Sent", group: WorkflowGroup.PLANNING },
  "deposit-requested": { label: "Deposit Requested", group: WorkflowGroup.PAYMENT },
  "deposit-received": { label: "Deposit Received", group: WorkflowGroup.PAYMENT },
  "details-confirmed": { label: "Event Details Confirmed", group: WorkflowGroup.LOGISTICS },
  "signup-link-created": { label: "Sign-Up Link Created", group: WorkflowGroup.LOGISTICS },
  "signup-link-sent": { label: "Sign-Up Link Sent", group: WorkflowGroup.LOGISTICS },
  "signups-monitored": { label: "Sign-Ups Monitored", group: WorkflowGroup.LOGISTICS },
  "final-payment": { label: "Final Payment Received", group: WorkflowGroup.PAYMENT },
  "final-confirmation": { label: "Final Confirmation Sent", group: WorkflowGroup.PRE_EVENT },
  "prep-complete": { label: "Day-Of Prep Complete", group: WorkflowGroup.PRE_EVENT },
  "event-delivered": { label: "Event Delivered", group: WorkflowGroup.EXECUTION },
  "follow-up-complete": { label: "Post-Event Follow-Up", group: WorkflowGroup.EXECUTION }
};

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
  const importedNames = [];

  for (const item of data.items) {
    const locationName = getTextValue(item, COLUMN_IDS.finalLocation) || getTextValue(item, COLUMN_IDS.preferredLocation);
    const stage = STATUS_TO_STAGE[getTextValue(item, "where_are_we_now")] ?? BuyoutStage.INQUIRY;

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
        clientEmail: getTextValue(item, COLUMN_IDS.clientEmail) || "unknown@placeholder.local",
        preferredDates: getTextValue(item, COLUMN_IDS.preferredDate1) || null,
        preferredLocation: getTextValue(item, COLUMN_IDS.preferredLocation) || null,
        notes: "Imported from Monday"
      },
      create: {
        legacyMondayItemId: item.id,
        source: "monday-import",
        clientName: item.name,
        clientEmail: getTextValue(item, COLUMN_IDS.clientEmail) || "unknown@placeholder.local",
        preferredDates: getTextValue(item, COLUMN_IDS.preferredDate1) || null,
        preferredLocation: getTextValue(item, COLUMN_IDS.preferredLocation) || null,
        notes: "Imported from Monday"
      }
    });

    const buyout = await prisma.buyout.upsert({
      where: { legacyMondayItemId: item.id },
      update: {
        displayName: item.name,
        inquiryId: inquiry.id,
        lifecycleStage: stage,
        trackingHealth: TRACKING_TO_HEALTH[getTextValue(item, COLUMN_IDS.tracking)] ?? TrackingHealth.ON_TRACK,
        ballInCourt: BALL_TO_ENUM[getTextValue(item, "ball_in_court")] ?? BallInCourt.TEAM,
        nextAction: getTextValue(item, "whats_due_next") || null,
        eventDate: getTextValue(item, COLUMN_IDS.finalizedDate) ? new Date(getTextValue(item, COLUMN_IDS.finalizedDate)) : null,
        startTime: getTextValue(item, COLUMN_IDS.startTime) || null,
        endTime: getTextValue(item, COLUMN_IDS.endTime) || null,
        instructorName: getTextValue(item, COLUMN_IDS.instructor) || null,
        locationId: location?.id ?? null
      },
      create: {
        legacyMondayItemId: item.id,
        displayName: item.name,
        inquiryId: inquiry.id,
        lifecycleStage: stage,
        trackingHealth: TRACKING_TO_HEALTH[getTextValue(item, COLUMN_IDS.tracking)] ?? TrackingHealth.ON_TRACK,
        ballInCourt: BALL_TO_ENUM[getTextValue(item, "ball_in_court")] ?? BallInCourt.TEAM,
        nextAction: getTextValue(item, "whats_due_next") || null,
        eventDate: getTextValue(item, COLUMN_IDS.finalizedDate) ? new Date(getTextValue(item, COLUMN_IDS.finalizedDate)) : null,
        startTime: getTextValue(item, COLUMN_IDS.startTime) || null,
        endTime: getTextValue(item, COLUMN_IDS.endTime) || null,
        instructorName: getTextValue(item, COLUMN_IDS.instructor) || null,
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

    const existingIntakeStep = await prisma.buyoutWorkflowStep.findFirst({
      where: { buyoutId: buyout.id }
    });

    if (!existingIntakeStep) {
      for (const stepKey of deriveDefaultWorkflow(stage)) {
        const definition = WORKFLOW_DEFINITIONS[stepKey];

        await prisma.buyoutWorkflowStep.create({
          data: {
            id: `${buyout.id}_${stepKey}`,
            buyoutId: buyout.id,
            stepKey,
            label: definition.label,
            stepGroup: definition.group,
            isComplete: true
          }
        });
      }
    }

    imported += 1;
    importedNames.push(item.name);
  }

  console.log(`Imported ${imported} Monday items into Prisma.`);
  console.log(`Imported records: ${importedNames.join(", ")}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
