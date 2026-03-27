import { BallInCourt, BuyoutStage, TrackingHealth, WorkflowGroup } from "@prisma/client";

import { mockBuyouts } from "@/lib/mock-data";
import { prisma } from "@/lib/prisma";
import { BuyoutInquiryInput, BuyoutSummary, WorkflowStep } from "@/lib/types";
import { buildWorkflow } from "@/lib/workflows";

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

  return buyouts.map((buyout) => ({
    id: buyout.id,
    name: buyout.displayName,
    eventType: buyout.inquiry?.eventType ?? "Buyout",
    eventDate: buyout.eventDate ? buyout.eventDate.toISOString().slice(0, 10) : "TBD",
    location: buyout.location?.name ?? "Unassigned",
    assignedTo: buyout.assignedManager?.name ?? "Unassigned",
    lifecycleStage: stageLabelMap[buyout.lifecycleStage],
    trackingHealth: trackingLabelMap[buyout.trackingHealth],
    ballInCourt: ballInCourtLabelMap[buyout.ballInCourt],
    nextAction: buyout.nextAction ?? "Review record",
    signups: buyout.signupCount,
    capacity: buyout.capacity ?? 0,
    total: buyout.financial?.quotedTotal ?? 0,
    amountPaid: buyout.financial?.amountPaid ?? 0,
    notes: buyout.notesInternal ?? "",
    workflow: normalizeWorkflow(buyout.workflowSteps)
  }));
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
