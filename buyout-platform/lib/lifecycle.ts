import type { BallInCourtKey, StageKey, TrackingKey, WorkflowStep } from "@/lib/types";
import { BUYOUT_PHASES } from "@/lib/buyout-phases";

const STAGE_ORDER: StageKey[] = [
  "Inquiry", "Respond", "Discuss", "Feasible", "Quote", "Deposit",
  "Paid", "Sign-Ups", "Confirmed", "Final", "Ready", "Complete"
];

const TERMINAL_STAGES = new Set<StageKey>(["Complete", "Cancelled", "DOA", "Not Possible"]);

type WorkflowState = {
  completedKeys: Set<string>;
  sentTemplateIds: string[];
  currentStage: StageKey;
  countdownDays: number | null;
  daysWaiting: number;
  amountPaid: number;
  total: number;
  signups: number;
  capacity: number;
};

export function deriveLifecycleState(state: WorkflowState): {
  lifecycleStage: StageKey;
  nextAction: string;
  ballInCourt: BallInCourtKey;
  trackingHealth: TrackingKey;
} {
  const { currentStage } = state;

  if (TERMINAL_STAGES.has(currentStage)) {
    const phase = BUYOUT_PHASES[currentStage];
    return {
      lifecycleStage: currentStage,
      nextAction: phase?.nextAction ?? "Closed",
      ballInCourt: phase?.ballInCourt ?? "Team",
      trackingHealth: "Complete"
    };
  }

  if (currentStage === "On Hold") {
    return {
      lifecycleStage: "On Hold",
      nextAction: BUYOUT_PHASES["On Hold"].nextAction,
      ballInCourt: BUYOUT_PHASES["On Hold"].ballInCourt,
      trackingHealth: "On track"
    };
  }

  const phase = BUYOUT_PHASES[currentStage];
  const nextAction = phase?.nextAction ?? "Review record";
  const ballInCourt = phase?.ballInCourt ?? "Team";

  const trackingHealth = deriveTrackingHealth(state);

  return {
    lifecycleStage: currentStage,
    nextAction,
    ballInCourt,
    trackingHealth
  };
}

function deriveTrackingHealth(state: WorkflowState): TrackingKey {
  if (TERMINAL_STAGES.has(state.currentStage)) {
    return "Complete";
  }

  if (state.countdownDays !== null && state.countdownDays < 0) {
    return "Major issue";
  }

  if (
    state.countdownDays !== null &&
    state.countdownDays <= 3 &&
    (state.amountPaid < state.total || (state.capacity > 0 && state.signups < state.capacity))
  ) {
    return "Major issue";
  }

  if (
    state.countdownDays !== null &&
    state.countdownDays <= 7 &&
    state.completedKeys.size < 12
  ) {
    return "At risk";
  }

  if (state.daysWaiting > 5) {
    return "At risk";
  }

  return "On track";
}

export function deriveStageFromWorkflow(
  workflow: WorkflowStep[],
  sentTemplateIds: string[],
  currentStage: StageKey,
  buyoutData: {
    countdownDays: number | null;
    daysWaiting: number;
    amountPaid: number;
    total: number;
    signups: number;
    capacity: number;
  }
) {
  const completedKeys = new Set(
    workflow.filter((step) => step.complete).map((step) => step.key)
  );

  return deriveLifecycleState({
    completedKeys,
    sentTemplateIds,
    currentStage,
    ...buyoutData
  });
}

export function getManualStageOptions(currentStage: StageKey): Array<{ value: StageKey; label: string }> {
  const options: Array<{ value: StageKey; label: string }> = [];

  if (!TERMINAL_STAGES.has(currentStage) && currentStage !== "On Hold") {
    const currentIndex = STAGE_ORDER.indexOf(currentStage);
    if (currentIndex >= 0 && currentIndex < STAGE_ORDER.length - 1) {
      const next = STAGE_ORDER[currentIndex + 1];
      options.push({ value: next, label: `Advance to ${next}` });
    }
    if (currentIndex > 0) {
      const prev = STAGE_ORDER[currentIndex - 1];
      options.push({ value: prev, label: `Revert to ${prev}` });
    }
  }

  if (currentStage === "On Hold") {
    options.push({ value: "Inquiry", label: "Reactivate — Inquiry" });
    options.push({ value: "Discuss", label: "Reactivate — Discuss" });
    options.push({ value: "Deposit", label: "Reactivate — Deposit" });
  }

  if (!TERMINAL_STAGES.has(currentStage)) {
    options.push({ value: "On Hold", label: "Put On Hold" });
    options.push({ value: "DOA", label: "Mark as DOA (No Response)" });
    options.push({ value: "Not Possible", label: "Mark as Not Possible" });
    options.push({ value: "Cancelled", label: "Cancel Buyout" });
  }

  if (TERMINAL_STAGES.has(currentStage) || currentStage === "On Hold") {
    options.push({ value: "Inquiry", label: "Reopen — Inquiry" });
  }

  return options;
}
