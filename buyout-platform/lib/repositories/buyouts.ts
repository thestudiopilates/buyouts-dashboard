import { BallInCourt, BuyoutStage, TrackingHealth, WorkflowGroup } from "@prisma/client";

import { getBuyoutPhase } from "@/lib/buyout-phases";
import { mockBuyouts } from "@/lib/mock-data";
import { prisma } from "@/lib/prisma";
import { BuyoutInquiryInput, BuyoutSummary, BuyoutUpdateInput, WorkflowStep } from "@/lib/types";
import { buildWorkflow } from "@/lib/workflows";

const TEST_ITEM_ID = "10989594648";
const TEST_EMAIL = "kelly@thestudiopilates.com";
const TEST_SIGNUP_LINK = "https://momence.com/l/4ZhnW48O";
const TEST_SENT_TEMPLATES = ["t5"];

const TRACKING_SOURCE_LABEL_MAP: Record<string, BuyoutSummary["trackingHealth"]> = {
  "So far so good": "On track",
  "Running behind": "At risk",
  "Major issue": "Major issue",
  Complete: "Complete"
};

const BALL_SOURCE_LABEL_MAP: Record<string, BuyoutSummary["ballInCourt"]> = {
  "TSP Team": "Team",
  Client: "Client",
  Both: "Both"
};

function getSignupLinkFromSnapshot(sourceSnapshot: unknown) {
  if (
    !sourceSnapshot ||
    typeof sourceSnapshot !== "object" ||
    !("values" in sourceSnapshot) ||
    !sourceSnapshot.values ||
    typeof sourceSnapshot.values !== "object" ||
    !("signupLink" in sourceSnapshot.values)
  ) {
    return undefined;
  }

  return typeof sourceSnapshot.values.signupLink === "string"
    ? sourceSnapshot.values.signupLink
    : undefined;
}

function stageRank(stage: BuyoutSummary["lifecycleStage"]) {
  return STAGE_ORDER.indexOf(stage);
}

function reconcileOperationalState({
  workflow,
  countdown,
  sourceLifecycleStage,
  sourceTrackingHealth,
  sourceBallInCourt,
  sourceStatusLabel,
  sourceNextAction,
  amountPaid,
  isInternalTest
}: {
  workflow: WorkflowStep[];
  countdown: number | null;
  sourceLifecycleStage: BuyoutSummary["lifecycleStage"];
  sourceTrackingHealth: BuyoutSummary["trackingHealth"];
  sourceBallInCourt: BuyoutSummary["ballInCourt"];
  sourceStatusLabel: string;
  sourceNextAction: string;
  amountPaid: number;
  isInternalTest: boolean;
}) {
  const completed = new Set(workflow.filter((step) => step.complete).map((step) => step.key));

  if (completed.has("momence-link-sign-up-sent") && stageRank(sourceLifecycleStage) < stageRank("Sign-Ups")) {
    const phase = getBuyoutPhase("Sign-Ups");
    return {
      statusLabel: phase.statusLabel,
      lifecycleStage: "Sign-Ups" as const,
      trackingHealth: sourceTrackingHealth === "Major issue" ? sourceTrackingHealth : "At risk" as const,
      ballInCourt: phase.ballInCourt,
      nextAction: phase.nextAction
    };
  }

  if (completed.has("deposit-paid-and-terms-signed") && stageRank(sourceLifecycleStage) < stageRank("Deposit")) {
    const phase = getBuyoutPhase("Paid");
    return {
      statusLabel: phase.statusLabel,
      lifecycleStage: "Paid" as const,
      trackingHealth: "On track" as const,
      ballInCourt: phase.ballInCourt,
      nextAction: phase.nextAction
    };
  }

  if (
    completed.has("all-attendees-registered") &&
    completed.has("all-waivers-signed") &&
    stageRank(sourceLifecycleStage) < stageRank("Confirmed")
  ) {
    const phase = getBuyoutPhase("Confirmed");
    return {
      statusLabel: phase.statusLabel,
      lifecycleStage: "Confirmed" as const,
      trackingHealth: "On track" as const,
      ballInCourt: phase.ballInCourt,
      nextAction: phase.nextAction
    };
  }

  if (completed.has("final-confirmation-emails-sent") && stageRank(sourceLifecycleStage) < stageRank("Final")) {
    const phase = getBuyoutPhase("Final");
    return {
      statusLabel: phase.statusLabel,
      lifecycleStage: "Final" as const,
      trackingHealth: sourceTrackingHealth,
      ballInCourt: phase.ballInCourt,
      nextAction: phase.nextAction
    };
  }

  if (completed.has("event-completed")) {
    const phase = getBuyoutPhase("Complete");
    return {
      statusLabel: phase.statusLabel,
      lifecycleStage: "Complete" as const,
      trackingHealth: "Complete" as const,
      ballInCourt: phase.ballInCourt,
      nextAction: phase.nextAction
    };
  }

  if (
    !isInternalTest &&
    countdown !== null &&
    countdown < 0 &&
    !["Complete", "Cancelled"].includes(sourceLifecycleStage)
  ) {
    return {
      statusLabel: "Source Cleanup Required",
      lifecycleStage: "Ready" as const,
      trackingHealth: "Major issue" as const,
      ballInCourt: "Team" as const,
      nextAction: "Clean up event date and payment state"
    };
  }

  if (!isInternalTest && completed.has("remaining-payment-received") && amountPaid === 0) {
    return {
      statusLabel: "Source Cleanup Required",
      lifecycleStage: sourceLifecycleStage,
      trackingHealth: "Major issue" as const,
      ballInCourt: "Team" as const,
      nextAction: "Resolve payment mismatch from Monday"
    };
  }

  return {
    statusLabel: sourceStatusLabel,
    lifecycleStage: sourceLifecycleStage,
    trackingHealth: sourceTrackingHealth,
    ballInCourt: sourceBallInCourt,
    nextAction: sourceNextAction
  };
}

function formatTime(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "America/New_York"
  }).format(date);
}

function parseClockTime(input: string) {
  const match = input.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) {
    return null;
  }

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  const meridiem = match[3].toUpperCase();

  if (!Number.isFinite(hours) || !Number.isFinite(minutes) || hours < 1 || hours > 12 || minutes < 0 || minutes > 59) {
    return null;
  }

  const normalizedHours = hours % 12 + (meridiem === "PM" ? 12 : 0);
  return normalizedHours * 60 + minutes;
}

function deriveNumberOfHours(input: {
  startTime?: string;
  endTime?: string;
  quotedTotal?: number | null;
}) {
  const startMinutes = input.startTime ? parseClockTime(input.startTime) : null;
  const endMinutes = input.endTime ? parseClockTime(input.endTime) : null;

  if (startMinutes !== null && endMinutes !== null) {
    const sameDayDuration = endMinutes - startMinutes;
    const overnightDuration = endMinutes + 24 * 60 - startMinutes;
    const durationMinutes = sameDayDuration > 0 ? sameDayDuration : overnightDuration;

    if (durationMinutes > 0) {
      return Number((durationMinutes / 60).toFixed(2));
    }
  }

  if (input.quotedTotal && input.quotedTotal > 0) {
    return Number((input.quotedTotal / 450).toFixed(2));
  }

  return undefined;
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
      emails: {
        orderBy: { sentAt: "desc" }
      },
      workflowSteps: {
        orderBy: { createdAt: "asc" }
      }
    },
    orderBy: [{ eventDate: "asc" }, { createdAt: "desc" }]
  });

  return buyouts.map((buyout) => {
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
    const numberOfHours = deriveNumberOfHours({
      startTime: derivedStartTime,
      endTime: derivedEndTime,
      quotedTotal: buyout.financial?.quotedTotal
    });
    const sourceStatusLabel = buyout.sourceStatusLabel ?? lifecycleStage;
    const sourceLifecycleStage = lifecycleStage;
    const sourceTrackingHealth = trackingLabelMap[buyout.trackingHealth];
    const sourceBallInCourt = ballInCourtLabelMap[buyout.ballInCourt];
    const sourceNextAction = buyout.sourceNextActionLabel ?? buyout.nextAction ?? "Review record";
    const reconciledState = reconcileOperationalState({
      workflow,
      countdown,
      sourceLifecycleStage,
      sourceTrackingHealth,
      sourceBallInCourt,
      sourceStatusLabel,
      sourceNextAction,
      amountPaid: buyout.financial?.amountPaid ?? 0,
      isInternalTest: isKellyTest
    });
    const effectiveLifecycleStage = reconciledState.lifecycleStage;
    const effectiveTrackingHealth = reconciledState.trackingHealth;
    const effectiveBallInCourt =
      isKellyTest || (buyout.inquiry?.clientEmail ?? "").toLowerCase() === TEST_EMAIL
        ? "Team"
        : reconciledState.ballInCourt;
    const effectiveNextAction = reconciledState.nextAction;
    const effectiveStatusLabel = reconciledState.statusLabel;
    const healthFlags = [
      !isKellyTest && countdown !== null && countdown < 0 ? "Event date on the source board is in the past." : null,
      !isKellyTest &&
      workflow.some((step) => step.key === "remaining-payment-received" && step.complete) &&
      (buyout.financial?.amountPaid ?? 0) === 0
        ? "Workflow shows payment completed, but financials still show $0 paid."
        : null,
      lifecycleStage === "Discuss" &&
      workflow.some((step) => step.key === "date-finalized" && step.complete)
        ? "Lifecycle status is behind the checklist state on the Monday board."
        : null,
      !isKellyTest && effectiveStatusLabel !== sourceStatusLabel
        ? `Operationally this reads as "${effectiveStatusLabel}" even though Monday still shows "${sourceStatusLabel}".`
        : null
    ].filter((value): value is string => Boolean(value));

    const sentTemplateIds = Array.from(
      new Set(
        (isKellyTest ? TEST_SENT_TEMPLATES : [])
          .concat(
            buyout.emails
              .filter((email) => email.status === "SENT")
              .map((email) => email.templateKey)
          )
      )
    );

    return {
    id: buyout.id,
    name: buyout.displayName,
    eventType: buyout.inquiry?.eventType ?? "Buyout",
    statusLabel: effectiveStatusLabel,
    sourceStatusLabel,
    eventDate: toIsoDay(buyout.eventDate),
    countdownDays: countdown,
    location: buyout.location?.name ?? "Unassigned",
    assignedTo:
      isKellyTest
        ? "Kelly"
        : buyout.assignedManager?.name ?? buyout.instructorName ?? "Unassigned",
    instructor: buyout.instructorName ?? "Unassigned",
    lifecycleStage: effectiveLifecycleStage,
    sourceLifecycleStage,
    lifecycleStep: Math.max(0, STAGE_ORDER.indexOf(effectiveLifecycleStage)),
    trackingHealth: effectiveTrackingHealth,
    sourceTrackingHealth: buyout.sourceTrackingLabel
      ? TRACKING_SOURCE_LABEL_MAP[buyout.sourceTrackingLabel] ?? sourceTrackingHealth
      : sourceTrackingHealth,
    ballInCourt: effectiveBallInCourt,
    sourceBallInCourt: buyout.sourceBallInCourtLabel
      ? BALL_SOURCE_LABEL_MAP[buyout.sourceBallInCourtLabel] ?? sourceBallInCourt
      : sourceBallInCourt,
    nextAction: effectiveNextAction,
    sourceNextAction,
    daysWaiting: waiting,
    lastAction: buyout.lastActionAt ? toIsoDay(buyout.lastActionAt) : null,
    signups: buyout.signupCount,
    capacity: buyout.capacity ?? 0,
    signupFillPercent,
    total: buyout.financial?.quotedTotal ?? 0,
    amountPaid: buyout.financial?.amountPaid ?? 0,
    outstanding,
    paymentProgress,
    numberOfHours,
    clientName:
      isKellyTest
        ? "Kelly Jackson"
        : buyout.inquiry?.clientName ?? buyout.displayName,
    clientEmail:
      isKellyTest
        ? TEST_EMAIL
        : buyout.inquiry?.clientEmail ?? "",
    clientPhone: buyout.inquiry?.clientPhone ?? undefined,
    startTime: derivedStartTime,
    endTime: derivedEndTime,
    preferredDates: buyout.inquiry?.preferredDates ?? undefined,
    preferredLocation: buyout.inquiry?.preferredLocation ?? undefined,
    depositAmount: buyout.financial?.depositAmount ?? undefined,
    depositLink: buyout.financial?.depositLink ?? undefined,
    balanceLink: buyout.financial?.balanceLink ?? undefined,
    signupLink: isKellyTest ? TEST_SIGNUP_LINK : getSignupLinkFromSnapshot(buyout.sourceSnapshot),
    notes: buyout.notesInternal ?? "",
    healthFlags,
    sentTemplateIds,
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

export async function updateBuyoutInDb(id: string, input: BuyoutUpdateInput) {
  const existing = await prisma.buyout.findUnique({
    where: { id },
    include: {
      inquiry: true,
      financial: true,
      location: true,
      assignedManager: true
    }
  });

  if (!existing) {
    throw new Error("Buyout not found.");
  }

  const locationName = input.location?.trim();
  const assignedTo = input.assignedTo?.trim();

  const location =
    locationName && locationName !== existing.location?.name
      ? await prisma.location.upsert({
          where: { id: `loc_${locationName.toLowerCase().replace(/[^a-z0-9]+/g, "_")}` },
          update: { name: locationName },
          create: {
            id: `loc_${locationName.toLowerCase().replace(/[^a-z0-9]+/g, "_")}`,
            name: locationName
          }
        })
      : existing.location;

  const manager =
    assignedTo && assignedTo !== existing.assignedManager?.name
      ? await prisma.staffUser.upsert({
          where: { email: `${assignedTo.toLowerCase().replace(/[^a-z0-9]+/g, ".")}@thestudiopilates.local` },
          update: { name: assignedTo, role: "Manager" },
          create: {
            name: assignedTo,
            email: `${assignedTo.toLowerCase().replace(/[^a-z0-9]+/g, ".")}@thestudiopilates.local`,
            role: "Manager"
          }
        })
      : existing.assignedManager;

  await prisma.buyout.update({
    where: { id },
    data: {
      displayName: input.clientName,
      eventDate: input.eventDate ? new Date(`${input.eventDate}T12:00:00`) : null,
      startTime: input.startTime,
      endTime: input.endTime,
      instructorName: input.instructor,
      nextAction: input.nextAction,
      notesInternal: input.notes,
      locationId: location?.id ?? null,
      assignedManagerId: manager?.id ?? null
    }
  });

  if (existing.inquiryId) {
    await prisma.buyoutInquiry.update({
      where: { id: existing.inquiryId },
      data: {
        clientName: input.clientName,
        clientEmail: input.clientEmail,
        clientPhone: input.clientPhone,
        eventType: input.eventType
      }
    });
  }

  await prisma.buyoutFinancial.upsert({
    where: { buyoutId: id },
    update: {
      depositLink: input.depositLink,
      balanceLink: input.balanceLink
    },
    create: {
      buyoutId: id,
      depositLink: input.depositLink,
      balanceLink: input.balanceLink
    }
  });

  if (input.signupLink || existing.sourceSnapshot) {
    const snapshot =
      existing.sourceSnapshot && typeof existing.sourceSnapshot === "object" && !Array.isArray(existing.sourceSnapshot)
        ? { ...(existing.sourceSnapshot as Record<string, unknown>) }
        : {};
    const values =
      snapshot.values && typeof snapshot.values === "object" && !Array.isArray(snapshot.values)
        ? { ...(snapshot.values as Record<string, unknown>) }
        : {};

    if (input.signupLink) {
      values.signupLink = input.signupLink;
    }

    snapshot.values = values;

    await prisma.buyout.update({
      where: { id },
      data: {
        sourceSnapshot: snapshot as never
      }
    });
  }

  return prisma.buyout.findUnique({ where: { id } });
}
