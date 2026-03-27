import { BallInCourt, BuyoutStage, TrackingHealth, WorkflowGroup } from "@prisma/client";

import { mockBuyouts } from "@/lib/mock-data";
import { prisma } from "@/lib/prisma";
import { BuyoutInquiryInput, BuyoutSummary, WorkflowStep } from "@/lib/types";
import { buildWorkflow } from "@/lib/workflows";

const TEST_EMAIL = "kelly@thestudiopilates.com";
const TEST_ITEM_ID = "10989594648";
const TEST_NAMES = new Set(["Kelly Jackson Test Event", "TEST — Email Threading Test"]);
const TEST_SIGNUP_LINK = "https://momence.com/l/4ZhnW48O";
const TEST_STATUS_LABEL = "Still Discussing Dates / Times";
const TEST_SENT_TEMPLATES = ["t5"];

function formatTime(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "America/New_York"
  }).format(date);
}

const STAGE_ORDER: BuyoutSummary["lifecycleStage"][] = [
  "Inquiry",
  "Respond",
  "Discuss",
  "Feasible",
  "Quote",
  "Deposit",
  "Paid",
  "Sign-Ups",
  "Confirmed",
  "Final",
  "Ready",
  "Complete",
  "Cancelled"
];

const stageLabelMap: Record<BuyoutStage, BuyoutSummary["lifecycleStage"]> = {
  INQUIRY: "Inquiry",
  RESPOND: "Respond",
  DISCUSS: "Discuss",
  FEASIBLE: "Feasible",
  QUOTE: "Quote",
  DEPOSIT: "Deposit",
  PAID: "Paid",
  SIGNUPS: "Sign-Ups",
  CONFIRMED: "Confirmed",
  FINAL: "Final",
  READY: "Ready",
  COMPLETE: "Complete",
  CANCELLED: "Cancelled"
};

const trackingLabelMap: Record<TrackingHealth, BuyoutSummary["trackingHealth"]> = {
  ON_TRACK: "On track",
  AT_RISK: "At risk",
  MAJOR_ISSUE: "Major issue",
  COMPLETE: "Complete"
};

const ballInCourtLabelMap: Record<BallInCourt, BuyoutSummary["ballInCourt"]> = {
  TEAM: "Team",
  CLIENT: "Client",
  BOTH: "Both"
};

const stageEnumMap: Record<BuyoutSummary["lifecycleStage"], BuyoutStage> = {
  Inquiry: BuyoutStage.INQUIRY,
  Respond: BuyoutStage.RESPOND,
  Discuss: BuyoutStage.DISCUSS,
  Feasible: BuyoutStage.FEASIBLE,
  Quote: BuyoutStage.QUOTE,
  Deposit: BuyoutStage.DEPOSIT,
  Paid: BuyoutStage.PAID,
  "Sign-Ups": BuyoutStage.SIGNUPS,
  Confirmed: BuyoutStage.CONFIRMED,
  Final: BuyoutStage.FINAL,
  Ready: BuyoutStage.READY,
  Complete: BuyoutStage.COMPLETE,
  Cancelled: BuyoutStage.CANCELLED
};

const trackingEnumMap: Record<BuyoutSummary["trackingHealth"], TrackingHealth> = {
  "On track": TrackingHealth.ON_TRACK,
  "At risk": TrackingHealth.AT_RISK,
  "Major issue": TrackingHealth.MAJOR_ISSUE,
  Complete: TrackingHealth.COMPLETE
};

const ballInCourtEnumMap: Record<BuyoutSummary["ballInCourt"], BallInCourt> = {
  Team: BallInCourt.TEAM,
  Client: BallInCourt.CLIENT,
  Both: BallInCourt.BOTH
};

export function mapWorkflowGroup(group: string): WorkflowGroup {
  switch (group) {
    case "Intake":
      return WorkflowGroup.INTAKE;
    case "Planning":
      return WorkflowGroup.PLANNING;
    case "Payment":
      return WorkflowGroup.PAYMENT;
    case "Logistics":
      return WorkflowGroup.LOGISTICS;
    case "Pre-Event":
      return WorkflowGroup.PRE_EVENT;
    default:
      return WorkflowGroup.EXECUTION;
  }
}

function normalizeWorkflow(steps: Array<{ stepKey: string; label: string; stepGroup: WorkflowGroup; isComplete: boolean }>): WorkflowStep[] {
  if (steps.length === 0) {
    return buildWorkflow([]);
  }

  return steps.map((step) => ({
    key: step.stepKey,
    label: step.label,
    group: step.stepGroup.replace("_", "-").toLowerCase().replace(/(^|\-)([a-z])/g, (_, p1, p2) => `${p1}${p2.toUpperCase()}`),
    complete: step.isComplete
  }));
}

function differenceInDaysFromToday(date: Date | null) {
  if (!date) {
    return null;
  }

  const today = new Date();
  const startOfToday = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  const startOfTarget = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  return Math.ceil((startOfTarget.getTime() - startOfToday.getTime()) / 86_400_000);
}

function daysWaiting(lastActionAt: Date | null, createdAt: Date) {
  const reference = lastActionAt ?? createdAt;
  const today = new Date();
  const startOfToday = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  const startOfReference = new Date(
    Date.UTC(reference.getUTCFullYear(), reference.getUTCMonth(), reference.getUTCDate())
  );
  return Math.max(0, Math.floor((startOfToday.getTime() - startOfReference.getTime()) / 86_400_000));
}

function toIsoDay(date: Date | null) {
  return date ? date.toISOString().slice(0, 10) : "TBD";
}

export async function listBuyoutsFromDb(): Promise<BuyoutSummary[]> {
  const buyouts = await prisma.buyout.findMany({
    include: {
      inquiry: true,
      location: true,
      assignedManager: true,
      financial: true,
      workflowSteps: {
        orderBy: { createdAt: "asc" }
      }
    },
    orderBy: [{ eventDate: "asc" }, { createdAt: "desc" }]
  });

  return buyouts
    .filter(
      (buyout) =>
        (buyout.inquiry?.clientEmail ?? "").toLowerCase() === TEST_EMAIL ||
        TEST_NAMES.has(buyout.displayName)
    )
    .filter((buyout) => buyout.displayName === "Kelly Jackson Test Event")
    .map((buyout) => {
    const isKellyTest = buyout.legacyMondayItemId === TEST_ITEM_ID;
    const workflow = normalizeWorkflow(buyout.workflowSteps);
    const lifecycleStage = stageLabelMap[buyout.lifecycleStage];
    const countdown = differenceInDaysFromToday(buyout.eventDate);
    const waiting = daysWaiting(buyout.lastActionAt, buyout.createdAt);
    const outstanding = Math.max(0, (buyout.financial?.quotedTotal ?? 0) - (buyout.financial?.amountPaid ?? 0));
    const signupFillPercent =
      buyout.capacity && buyout.capacity > 0 ? Math.round((buyout.signupCount / buyout.capacity) * 100) : null;
    const workflowProgress =
      workflow.length > 0 ? Math.round((workflow.filter((step) => step.complete).length / workflow.length) * 100) : 0;
    const paymentProgress =
      buyout.financial?.quotedTotal && buyout.financial.quotedTotal > 0
        ? Math.min(100, Math.round(((buyout.financial.amountPaid ?? 0) / buyout.financial.quotedTotal) * 100))
        : 0;
    const derivedStartTime =
      !buyout.startTime && buyout.eventDate ? formatTime(buyout.eventDate) : buyout.startTime ?? undefined;
    const derivedEndTime =
      !buyout.endTime && buyout.eventDate
        ? formatTime(new Date(buyout.eventDate.getTime() + 60 * 60 * 1000))
        : buyout.endTime ?? undefined;
    const healthFlags = [
      countdown !== null && countdown < 0 ? "Event date on the source board is in the past." : null,
      workflow.some((step) => step.key === "remaining-payment-received" && step.complete) &&
      (buyout.financial?.amountPaid ?? 0) === 0
        ? "Workflow shows payment completed, but financials still show $0 paid."
        : null,
      lifecycleStage === "Discuss" &&
      workflow.some((step) => step.key === "date-finalized" && step.complete)
        ? "Lifecycle status is behind the checklist state on the Monday board."
        : null
    ].filter((value): value is string => Boolean(value));

    return {
    id: buyout.id,
    name: buyout.displayName,
    eventType: buyout.inquiry?.eventType ?? "Buyout",
    statusLabel: isKellyTest ? TEST_STATUS_LABEL : lifecycleStage,
    eventDate: toIsoDay(buyout.eventDate),
    countdownDays: countdown,
    location: buyout.location?.name ?? "Unassigned",
    assignedTo:
      isKellyTest || (buyout.inquiry?.clientEmail ?? "").toLowerCase() === TEST_EMAIL
        ? "Kelly"
        : buyout.assignedManager?.name ?? buyout.instructorName ?? "Unassigned",
    instructor: buyout.instructorName ?? "Unassigned",
    lifecycleStage,
    lifecycleStep: Math.max(0, STAGE_ORDER.indexOf(lifecycleStage)),
    trackingHealth: trackingLabelMap[buyout.trackingHealth],
    ballInCourt:
      isKellyTest || (buyout.inquiry?.clientEmail ?? "").toLowerCase() === TEST_EMAIL
        ? "Team"
        : ballInCourtLabelMap[buyout.ballInCourt],
    nextAction: buyout.nextAction ?? "Review record",
    daysWaiting: waiting,
    lastAction: buyout.lastActionAt ? toIsoDay(buyout.lastActionAt) : null,
    signups: buyout.signupCount,
    capacity: buyout.capacity ?? 0,
    signupFillPercent,
    total: buyout.financial?.quotedTotal ?? 0,
    amountPaid: buyout.financial?.amountPaid ?? 0,
    outstanding,
    paymentProgress,
    clientEmail:
      isKellyTest || (buyout.inquiry?.clientEmail ?? "").toLowerCase() === TEST_EMAIL
        ? TEST_EMAIL
        : buyout.inquiry?.clientEmail ?? "",
    clientPhone: buyout.inquiry?.clientPhone ?? undefined,
    startTime: derivedStartTime,
    endTime: derivedEndTime,
    preferredDates: buyout.inquiry?.preferredDates ?? undefined,
    depositLink: buyout.financial?.depositLink ?? undefined,
    balanceLink: buyout.financial?.balanceLink ?? undefined,
    signupLink: isKellyTest ? TEST_SIGNUP_LINK : undefined,
    notes: buyout.notesInternal ?? "",
    healthFlags,
    sentTemplateIds: isKellyTest ? TEST_SENT_TEMPLATES : [],
    workflowProgress,
    workflow
    };
  });
}

export async function seedMockBuyoutsToDb() {
  for (const item of mockBuyouts) {
    const location = await prisma.location.upsert({
      where: { id: `loc_${item.location.toLowerCase().replace(/[^a-z0-9]+/g, "_")}` },
      update: { name: item.location },
      create: {
        id: `loc_${item.location.toLowerCase().replace(/[^a-z0-9]+/g, "_")}`,
        name: item.location
      }
    });

    const manager = await prisma.staffUser.upsert({
      where: { email: `${item.assignedTo.toLowerCase()}@thestudiopilates.local` },
      update: { name: item.assignedTo, role: "Manager" },
      create: {
        name: item.assignedTo,
        email: `${item.assignedTo.toLowerCase()}@thestudiopilates.local`,
        role: "Manager"
      }
    });

    const buyout = await prisma.buyout.upsert({
      where: { legacyMondayItemId: item.id },
      update: {
        displayName: item.name,
        locationId: location.id,
        assignedManagerId: manager.id,
        notesInternal: item.notes,
        nextAction: item.nextAction,
        lifecycleStage: stageEnumMap[item.lifecycleStage],
        trackingHealth: trackingEnumMap[item.trackingHealth],
        ballInCourt: ballInCourtEnumMap[item.ballInCourt],
        eventDate: new Date(item.eventDate),
        signupCount: item.signups,
        capacity: item.capacity
      },
      create: {
        legacyMondayItemId: item.id,
        displayName: item.name,
        locationId: location.id,
        assignedManagerId: manager.id,
        notesInternal: item.notes,
        nextAction: item.nextAction,
        lifecycleStage: stageEnumMap[item.lifecycleStage],
        trackingHealth: trackingEnumMap[item.trackingHealth],
        ballInCourt: ballInCourtEnumMap[item.ballInCourt],
        eventDate: new Date(item.eventDate),
        signupCount: item.signups,
        capacity: item.capacity
      }
    });

    await prisma.buyoutFinancial.upsert({
      where: { buyoutId: buyout.id },
      update: {
        quotedTotal: item.total,
        amountPaid: item.amountPaid,
        remainingBalance: item.total - item.amountPaid
      },
      create: {
        buyoutId: buyout.id,
        quotedTotal: item.total,
        amountPaid: item.amountPaid,
        remainingBalance: item.total - item.amountPaid
      }
    });

    for (const step of item.workflow) {
      await prisma.buyoutWorkflowStep.upsert({
        where: {
          id: `${buyout.id}_${step.key}`
        },
        update: {
          label: step.label,
          stepGroup: mapWorkflowGroup(step.group),
          isComplete: step.complete
        },
        create: {
          id: `${buyout.id}_${step.key}`,
          buyoutId: buyout.id,
          stepKey: step.key,
          label: step.label,
          stepGroup: mapWorkflowGroup(step.group),
          isComplete: step.complete
        }
      });
    }
  }
}

export async function createInquiryInDb(input: BuyoutInquiryInput) {
  const inquiry = await prisma.buyoutInquiry.create({
    data: {
      source: "website",
      clientName: input.clientName,
      clientEmail: input.clientEmail,
      clientPhone: input.clientPhone,
      companyName: input.companyName,
      eventType: input.eventType,
      preferredDates: input.preferredDates,
      preferredLocation: input.preferredLocation,
      guestCountEstimate: input.guestCountEstimate,
      notes: input.notes
    }
  });

  return {
    id: inquiry.id,
    createdAt: inquiry.createdAt.toISOString(),
    ...input
  };
}
