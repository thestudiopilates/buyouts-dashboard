import { BallInCourt, BuyoutStage, TrackingHealth } from "@prisma/client";

import { BUYOUT_PHASES } from "@/lib/buyout-phases";
import { mockBuyouts } from "@/lib/mock-data";
import { hasDatabaseUrl, prisma } from "@/lib/prisma";
import { createInquiryInDb, getBuyoutFromDb, listBuyoutsFromDb, updateBuyoutInDb } from "@/lib/repositories/buyouts";
import { BuyoutInquiryInput, BuyoutSummary, BuyoutUpdateInput, StageKey } from "@/lib/types";

const STAGE_TO_ENUM: Record<StageKey, BuyoutStage> = {
  Inquiry: BuyoutStage.INQUIRY, Respond: BuyoutStage.RESPOND,
  Discuss: BuyoutStage.DISCUSS, Feasible: BuyoutStage.FEASIBLE,
  Quote: BuyoutStage.QUOTE, Deposit: BuyoutStage.DEPOSIT,
  Paid: BuyoutStage.PAID, "Sign-Ups": BuyoutStage.SIGNUPS,
  Confirmed: BuyoutStage.CONFIRMED, Final: BuyoutStage.FINAL,
  Ready: BuyoutStage.READY, Complete: BuyoutStage.COMPLETE,
  Cancelled: BuyoutStage.CANCELLED,
  DOA: BuyoutStage.DOA, "Not Possible": BuyoutStage.NOT_POSSIBLE,
  "On Hold": BuyoutStage.ON_HOLD
};

const TRACKING_TO_ENUM: Record<string, TrackingHealth> = {
  "On track": TrackingHealth.ON_TRACK, "At risk": TrackingHealth.AT_RISK,
  "Major issue": TrackingHealth.MAJOR_ISSUE, Complete: TrackingHealth.COMPLETE
};

const BIC_TO_ENUM: Record<string, BallInCourt> = {
  Team: BallInCourt.TEAM, Client: BallInCourt.CLIENT, Both: BallInCourt.BOTH
};

const inquiries: Array<BuyoutInquiryInput & { id: string; createdAt: string }> = [];
const localBuyoutOverrides = new Map<string, Partial<BuyoutSummary>>();

export async function listBuyouts(): Promise<BuyoutSummary[]> {
  if (hasDatabaseUrl()) {
    return listBuyoutsFromDb();
  }

  return mockBuyouts.map((buyout) => ({ ...buyout, ...(localBuyoutOverrides.get(buyout.id) ?? {}) }));
}

export async function getBuyout(id: string): Promise<BuyoutSummary | null> {
  if (hasDatabaseUrl()) {
    return getBuyoutFromDb(id);
  }

  const buyouts = await listBuyouts();
  return buyouts.find((buyout) => buyout.id === id) ?? null;
}

export async function updateBuyout(id: string, input: BuyoutUpdateInput) {
  if (hasDatabaseUrl()) {
    await updateBuyoutInDb(id, input);
    return getBuyout(id);
  }

  const current = await getBuyout(id);
  if (!current) {
    throw new Error("Buyout not found.");
  }

  const updated: BuyoutSummary = {
    ...current,
    name: input.clientName,
    clientName: input.clientName,
    clientEmail: input.clientEmail,
    clientPhone: input.clientPhone,
    eventType: input.eventType ?? current.eventType,
    eventDate: input.eventDate ?? current.eventDate,
    startTime: input.startTime,
    endTime: input.endTime,
    location: input.location ?? current.location,
    assignedTo: input.assignedTo ?? current.assignedTo,
    instructor: input.instructor ?? current.instructor,
    notes: input.notes ?? current.notes,
    depositLink: input.depositLink,
    balanceLink: input.balanceLink,
    signupLink: input.signupLink
  };

  localBuyoutOverrides.set(id, updated);
  return updated;
}

export async function createInquiry(input: BuyoutInquiryInput) {
  if (hasDatabaseUrl()) {
    return createInquiryInDb(input);
  }

  const inquiry = {
    id: `inq_${Date.now()}`,
    createdAt: new Date().toISOString(),
    ...input
  };

  inquiries.unshift(inquiry);
  return inquiry;
}

export async function listRecentInquiries() {
  return inquiries;
}

export async function toggleWorkflowStep(
  buyoutId: string,
  stepKey: string,
  isComplete: boolean
): Promise<BuyoutSummary | null> {
  if (!hasDatabaseUrl()) {
    const buyout = await getBuyout(buyoutId);
    if (!buyout) throw new Error("Buyout not found.");

    const step = buyout.workflow.find((s) => s.key === stepKey);
    if (step) step.complete = isComplete;

    localBuyoutOverrides.set(buyoutId, buyout);
    return buyout;
  }

  const record = await prisma.buyout.findUnique({
    where: { id: buyoutId },
    include: { workflowSteps: true, financial: true }
  });

  if (!record) throw new Error("Buyout not found.");

  const now = new Date();
  const existing = record.workflowSteps.find((s) => s.stepKey === stepKey);

  if (existing) {
    await prisma.buyoutWorkflowStep.update({
      where: { id: existing.id },
      data: {
        isComplete,
        completedAt: isComplete ? now : null,
        completedBy: isComplete ? "dashboard" : null
      }
    });
  } else if (isComplete) {
    await prisma.buyoutWorkflowStep.create({
      data: {
        id: `${buyoutId}_${stepKey}`,
        buyoutId,
        stepKey,
        label: stepKey.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" "),
        stepGroup: "EXECUTION",
        isComplete: true,
        completedAt: now,
        completedBy: "dashboard"
      }
    });
  }

  // Derive the current stage from workflow and write it back to the DB
  // so that cron queries filtering on lifecycleStage stay accurate.
  const derived = await getBuyout(buyoutId);
  if (derived) {
    const stageEnum = STAGE_TO_ENUM[derived.lifecycleStage as StageKey];
    const trackingEnum = TRACKING_TO_ENUM[derived.trackingHealth] ?? TrackingHealth.ON_TRACK;
    const bicEnum = BIC_TO_ENUM[derived.ballInCourt] ?? BallInCourt.TEAM;
    if (stageEnum) {
      await prisma.buyout.update({
        where: { id: buyoutId },
        data: {
          lifecycleStage: stageEnum,
          trackingHealth: trackingEnum,
          ballInCourt: bicEnum,
          nextAction: derived.nextAction
        }
      });
    }
  }

  return derived;
}

export async function setManualStage(
  buyoutId: string,
  newStage: StageKey
): Promise<BuyoutSummary | null> {
  if (!hasDatabaseUrl()) {
    const buyout = await getBuyout(buyoutId);
    if (!buyout) throw new Error("Buyout not found.");

    const phase = BUYOUT_PHASES[newStage];
    const updated = {
      ...buyout,
      lifecycleStage: newStage,
      nextAction: phase?.nextAction ?? "Review record",
      ballInCourt: phase?.ballInCourt ?? "Team"
    };

    localBuyoutOverrides.set(buyoutId, updated);
    return updated;
  }

  const stageEnum = STAGE_TO_ENUM[newStage];
  if (!stageEnum) throw new Error(`Invalid stage: ${newStage}`);

  const existing = await prisma.buyout.findUnique({ where: { id: buyoutId } });
  if (!existing) throw new Error("Buyout not found.");

  const phase = BUYOUT_PHASES[newStage];

  await prisma.buyout.update({
    where: { id: buyoutId },
    data: {
      lifecycleStage: stageEnum,
      ballInCourt: BIC_TO_ENUM[phase?.ballInCourt ?? "Team"],
      nextAction: phase?.nextAction ?? "Review record",
      lastActionAt: new Date()
    }
  });

  return getBuyout(buyoutId);
}
