import { BallInCourt, BuyoutStage, TrackingHealth } from "@prisma/client";

import { deriveStageFromWorkflow } from "@/lib/lifecycle";
import { mockBuyouts } from "@/lib/mock-data";
import { hasDatabaseUrl, prisma } from "@/lib/prisma";
import { createInquiryInDb, listBuyoutsFromDb, updateBuyoutInDb } from "@/lib/repositories/buyouts";
import { BuyoutInquiryInput, BuyoutSummary, BuyoutUpdateInput, StageKey } from "@/lib/types";

const STAGE_TO_ENUM: Record<StageKey, BuyoutStage> = {
  Inquiry: BuyoutStage.INQUIRY, Respond: BuyoutStage.RESPOND,
  Discuss: BuyoutStage.DISCUSS, Feasible: BuyoutStage.FEASIBLE,
  Quote: BuyoutStage.QUOTE, Deposit: BuyoutStage.DEPOSIT,
  Paid: BuyoutStage.PAID, "Sign-Ups": BuyoutStage.SIGNUPS,
  Confirmed: BuyoutStage.CONFIRMED, Final: BuyoutStage.FINAL,
  Ready: BuyoutStage.READY, Complete: BuyoutStage.COMPLETE,
  Cancelled: BuyoutStage.CANCELLED
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

    const derived = deriveStageFromWorkflow(
      buyout.workflow,
      buyout.sentTemplateIds,
      buyout.lifecycleStage,
      {
        countdownDays: buyout.countdownDays,
        daysWaiting: buyout.daysWaiting,
        amountPaid: buyout.amountPaid,
        total: buyout.total,
        signups: buyout.signups,
        capacity: buyout.capacity
      }
    );

    const updated = {
      ...buyout,
      lifecycleStage: derived.lifecycleStage,
      nextAction: derived.nextAction,
      ballInCourt: derived.ballInCourt,
      trackingHealth: derived.trackingHealth
    };

    localBuyoutOverrides.set(buyoutId, updated);
    return updated;
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

  const buyout = await getBuyout(buyoutId);
  if (!buyout) throw new Error("Buyout not found after update.");

  const derived = deriveStageFromWorkflow(
    buyout.workflow,
    buyout.sentTemplateIds,
    buyout.lifecycleStage,
    {
      countdownDays: buyout.countdownDays,
      daysWaiting: buyout.daysWaiting,
      amountPaid: buyout.amountPaid,
      total: buyout.total,
      signups: buyout.signups,
      capacity: buyout.capacity
    }
  );

  await prisma.buyout.update({
    where: { id: buyoutId },
    data: {
      lifecycleStage: STAGE_TO_ENUM[derived.lifecycleStage],
      trackingHealth: TRACKING_TO_ENUM[derived.trackingHealth],
      ballInCourt: BIC_TO_ENUM[derived.ballInCourt],
      nextAction: derived.nextAction,
      lastActionAt: now
    }
  });

  return getBuyout(buyoutId);
}
