import type { BallInCourtKey, StageKey, TrackingKey, WorkflowStep } from "@/lib/types";
import { BUYOUT_PHASES } from "@/lib/buyout-phases";

const STAGE_ORDER: StageKey[] = [
  "Inquiry", "Respond", "Discuss", "Feasible", "Quote", "Deposit",
  "Paid", "Sign-Ups", "Confirmed", "Final", "Ready", "Complete", "Cancelled"
];

function stageRank(stage: StageKey) {
  return STAGE_ORDER.indexOf(stage);
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

const STEP_STAGE_RULES: Array<{
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
    requires: ["front-desk-assigned"],
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
    nextAction: "Send event details and signup link to client",
    ballInCourt: "Team"
  },
  {
    requires: ["instructor-finalized"],
    advancesTo: "Paid",
    nextAction: "Create Momence class and signup link",
    ballInCourt: "Team"
  },
  {
    requires: ["deposit-paid-and-terms-signed"],
    advancesTo: "Paid",
    nextAction: "Finalize instructor and send event details",
    ballInCourt: "Team"
  },
  {
    requires: ["deposit-link-sent-and-terms-shared"],
    advancesTo: "Quote",
    nextAction: "Wait for deposit payment",
    ballInCourt: "Client"
  },
  {
    requires: ["date-finalized"],
    advancesTo: "Feasible",
    nextAction: "Prepare quote and send deposit link",
    ballInCourt: "Team"
  },
  {
    requires: ["customer-responded"],
    advancesTo: "Discuss",
    nextAction: "Confirm dates, location, and event details",
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

  if (currentStage === "Cancelled") {
    return {
      lifecycleStage: "Cancelled",
      nextAction: "Closed",
      ballInCourt: "Team",
      trackingHealth: "Complete"
    };
  }

  if (currentStage === "Complete" || completedKeys.has("event-completed")) {
    return {
      lifecycleStage: "Complete",
      nextAction: "Closed",
      ballInCourt: "Team",
      trackingHealth: "Complete"
    };
  }

  let derivedStage = currentStage;
  let derivedNextAction = BUYOUT_PHASES[currentStage]?.nextAction ?? "Review record";
  let derivedBallInCourt = BUYOUT_PHASES[currentStage]?.ballInCourt ?? "Team";

  for (const rule of STEP_STAGE_RULES) {
    if (rule.requires.every((key) => completedKeys.has(key))) {
      if (stageRank(rule.advancesTo) >= stageRank(derivedStage)) {
        derivedStage = rule.advancesTo;
        derivedNextAction = rule.nextAction;
        derivedBallInCourt = rule.ballInCourt;
      }
      break;
    }
  }

  const trackingHealth = deriveTrackingHealth({
    ...state,
    lifecycleStage: derivedStage
  });

  return {
    lifecycleStage: derivedStage,
    nextAction: derivedNextAction,
    ballInCourt: derivedBallInCourt,
    trackingHealth
  };
}

function deriveTrackingHealth(state: WorkflowState & { lifecycleStage: StageKey }): TrackingKey {
  if (state.lifecycleStage === "Complete" || state.lifecycleStage === "Cancelled") {
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
