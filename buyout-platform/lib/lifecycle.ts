import type { BallInCourtKey, StageKey, TrackingKey, WorkflowStep } from "@/lib/types";
import { BUYOUT_PHASES } from "@/lib/buyout-phases";

const STAGE_ORDER: StageKey[] = [
  "Inquiry", "Respond", "Discuss", "Feasible", "Quote", "Deposit",
  "Paid", "Sign-Ups", "Confirmed", "Final", "Ready", "Complete"
];

const TERMINAL_STAGES = new Set<StageKey>(["Complete", "Cancelled", "DOA", "Not Possible"]);

function stageRank(stage: StageKey) {
  const index = STAGE_ORDER.indexOf(stage);
  return index >= 0 ? index : -1;
}

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

const STEP_ADVANCEMENT_RULES: Array<{
  requires: string[];
  advancesTo: StageKey;
  nextAction: string;
  ballInCourt: BallInCourtKey;
}> = [
  {
    requires: ["event-completed"],
    advancesTo: "Complete",
    nextAction: "Closed",
    ballInCourt: "Team"
  },
  {
    requires: ["final-confirmation-emails-sent"],
    advancesTo: "Final",
    nextAction: "Prepare final event logistics",
    ballInCourt: "Team"
  },
  {
    requires: ["front-desk-assigned", "front-desk-shift-extended"],
    advancesTo: "Ready",
    nextAction: "Send final confirmation email",
    ballInCourt: "Team"
  },
  {
    requires: ["all-attendees-registered", "all-waivers-signed"],
    advancesTo: "Confirmed",
    nextAction: "Assign front desk and confirm remaining balance",
    ballInCourt: "Team"
  },
  {
    requires: ["remaining-payment-received"],
    advancesTo: "Confirmed",
    nextAction: "Monitor signups and waivers",
    ballInCourt: "Client"
  },
  {
    requires: ["momence-link-sign-up-sent"],
    advancesTo: "Sign-Ups",
    nextAction: "Monitor registrations and waivers",
    ballInCourt: "Client"
  },
  {
    requires: ["momence-class-created"],
    advancesTo: "Paid",
    nextAction: "Send event details to client (t5)",
    ballInCourt: "Team"
  },
  {
    requires: ["instructor-finalized"],
    advancesTo: "Paid",
    nextAction: "Create Momence event & update with signup URL",
    ballInCourt: "Team"
  },
  {
    requires: ["deposit-paid-and-terms-signed"],
    advancesTo: "Paid",
    nextAction: "Finalize instructor & update event details",
    ballInCourt: "Team"
  },
  {
    requires: ["deposit-link-sent-and-terms-shared"],
    advancesTo: "Quote",
    nextAction: "Wait for payment",
    ballInCourt: "Client"
  },
  {
    requires: ["date-finalized"],
    advancesTo: "Feasible",
    nextAction: "Update event details, then send payment link",
    ballInCourt: "Team"
  },
  {
    requires: ["customer-responded"],
    advancesTo: "Discuss",
    nextAction: "Confirm dates, times, location, and event details",
    ballInCourt: "Both"
  },
  {
    requires: ["initial-inquiry-response-sent"],
    advancesTo: "Respond",
    nextAction: "Wait for client response",
    ballInCourt: "Client"
  },
  {
    requires: ["inquiry-reviewed"],
    advancesTo: "Inquiry",
    nextAction: "Send initial inquiry response",
    ballInCourt: "Team"
  }
];

export function deriveLifecycleState(state: WorkflowState): {
  lifecycleStage: StageKey;
  nextAction: string;
  ballInCourt: BallInCourtKey;
  trackingHealth: TrackingKey;
} {
  const { completedKeys, currentStage } = state;

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

  let derivedStage: StageKey = currentStage;
  let derivedNextAction: string = BUYOUT_PHASES[currentStage]?.nextAction ?? "Review record";
  let derivedBallInCourt: BallInCourtKey = BUYOUT_PHASES[currentStage]?.ballInCourt ?? "Team";

  for (const rule of STEP_ADVANCEMENT_RULES) {
    if (rule.requires.every((key) => completedKeys.has(key))) {
      if (stageRank(rule.advancesTo) > stageRank(derivedStage)) {
        derivedStage = rule.advancesTo;
        derivedNextAction = rule.nextAction;
        derivedBallInCourt = rule.ballInCourt;
      }
      break;
    }
  }

  const trackingHealth = deriveTrackingHealth({
    ...state,
    currentStage: derivedStage
  });

  return {
    lifecycleStage: derivedStage,
    nextAction: derivedNextAction,
    ballInCourt: derivedBallInCourt,
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

export type ResponseUrgency = "on-track" | "needs-attention" | "overdue" | "critical" | null;

export function deriveResponseUrgency(input: {
  ballInCourt: BallInCourtKey;
  daysWaiting: number;
  countdownDays: number | null;
  lastClientContactDaysAgo: number | null;
  lastTeamActionDaysAgo: number | null;
  lifecycleStage: StageKey;
}): ResponseUrgency {
  if (TERMINAL_STAGES.has(input.lifecycleStage)) return null;
  if (input.lifecycleStage === "On Hold") return null;

  const { ballInCourt, countdownDays, lastClientContactDaysAgo, lastTeamActionDaysAgo } = input;

  // When WE owe a response (client wrote us, we haven't replied)
  if (ballInCourt === "Team" && lastClientContactDaysAgo !== null) {
    if (countdownDays !== null && countdownDays <= 14 && lastClientContactDaysAgo >= 1) return "critical";
    if (lastClientContactDaysAgo > 1) return "overdue";
    if (lastClientContactDaysAgo >= 1) return "needs-attention";
    return "on-track";
  }

  // When CLIENT owes a response (we sent something, waiting)
  if (ballInCourt === "Client" && lastTeamActionDaysAgo !== null) {
    if (lastTeamActionDaysAgo > 7) return "overdue";
    if (lastTeamActionDaysAgo > 5) return "needs-attention";
    if (lastTeamActionDaysAgo > 3) return "needs-attention";
    return "on-track";
  }

  // Both or unknown — use days waiting as fallback
  if (input.daysWaiting > 5) return "needs-attention";
  if (input.daysWaiting > 3) return "on-track";

  return "on-track";
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
