import type { BallInCourtKey, StageKey } from "@/lib/types";

export type BuyoutPhaseConfig = {
  stage: StageKey;
  statusLabel: string;
  nextAction: string;
  ballInCourt: BallInCourtKey;
  templateKeys: string[];
};

export const BUYOUT_PHASES: Record<StageKey, BuyoutPhaseConfig> = {
  Inquiry: {
    stage: "Inquiry",
    statusLabel: "New Inquiry Received",
    nextAction: "Review inquiry and send initial response",
    ballInCourt: "Team",
    templateKeys: ["t1", "t2", "t13"]
  },
  Respond: {
    stage: "Respond",
    statusLabel: "Initial Response Sent",
    nextAction: "Wait for client response",
    ballInCourt: "Client",
    templateKeys: ["t2", "t13"]
  },
  Discuss: {
    stage: "Discuss",
    statusLabel: "Ongoing Discussion",
    nextAction: "Confirm dates, location, and event details",
    ballInCourt: "Both",
    templateKeys: ["t2", "t13"]
  },
  Feasible: {
    stage: "Feasible",
    statusLabel: "Feasibility Confirmed",
    nextAction: "Prepare quote and deposit terms",
    ballInCourt: "Team",
    templateKeys: ["t3", "t13"]
  },
  Quote: {
    stage: "Quote",
    statusLabel: "Quote Sent",
    nextAction: "Send deposit and date confirmation",
    ballInCourt: "Client",
    templateKeys: ["t3", "t4", "t13"]
  },
  Deposit: {
    stage: "Deposit",
    statusLabel: "Awaiting Deposit",
    nextAction: "Follow up on deposit payment",
    ballInCourt: "Client",
    templateKeys: ["t4", "t13"]
  },
  Paid: {
    stage: "Paid",
    statusLabel: "Deposit Received",
    nextAction: "Finalize instructor and send event details",
    ballInCourt: "Team",
    templateKeys: ["t5", "t6", "t13"]
  },
  "Sign-Ups": {
    stage: "Sign-Ups",
    statusLabel: "Awaiting Guest Sign-Ups",
    nextAction: "Monitor registrations and waivers",
    ballInCourt: "Client",
    templateKeys: ["t6", "t10", "t13", "t14"]
  },
  Confirmed: {
    stage: "Confirmed",
    statusLabel: "Sign-Ups Complete",
    nextAction: "Confirm remaining balance and prep final communication",
    ballInCourt: "Team",
    templateKeys: ["t6", "t7", "t11", "t13"]
  },
  Final: {
    stage: "Final",
    statusLabel: "Final Confirmation Sent",
    nextAction: "Prepare final event logistics",
    ballInCourt: "Team",
    templateKeys: ["t7", "t11", "t13", "t14"]
  },
  Ready: {
    stage: "Ready",
    statusLabel: "Ready for Event",
    nextAction: "Host event and capture any final changes",
    ballInCourt: "Team",
    templateKeys: ["t12", "t13", "t14"]
  },
  Complete: {
    stage: "Complete",
    statusLabel: "Event Complete",
    nextAction: "Closed",
    ballInCourt: "Team",
    templateKeys: ["t12"]
  },
  Cancelled: {
    stage: "Cancelled",
    statusLabel: "Cancelled",
    nextAction: "Closed",
    ballInCourt: "Team",
    templateKeys: ["t8", "t9"]
  }
};

export function getBuyoutPhase(stage: StageKey) {
  return BUYOUT_PHASES[stage];
}
