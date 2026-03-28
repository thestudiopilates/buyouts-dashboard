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
    templateKeys: ["t0", "t1", "t2", "t13"]
  },
  Respond: {
    stage: "Respond",
    statusLabel: "Initial Response Sent",
    nextAction: "Wait for client response",
    ballInCourt: "Client",
    templateKeys: ["t0", "t2", "t13"]
  },
  Discuss: {
    stage: "Discuss",
    statusLabel: "In Discussion",
    nextAction: "Confirm dates, times, location, and event details",
    ballInCourt: "Both",
    templateKeys: ["t0", "t2", "t13"]
  },
  Feasible: {
    stage: "Feasible",
    statusLabel: "Date Agreed — Update Details & Send Payment",
    nextAction: "Update event details, then send payment link",
    ballInCourt: "Team",
    templateKeys: ["t0", "t3", "t13"]
  },
  Quote: {
    stage: "Quote",
    statusLabel: "Payment Link Sent",
    nextAction: "Wait for payment",
    ballInCourt: "Client",
    templateKeys: ["t0", "t3", "t4", "t13"]
  },
  Deposit: {
    stage: "Deposit",
    statusLabel: "Awaiting Payment",
    nextAction: "Follow up on payment status",
    ballInCourt: "Client",
    templateKeys: ["t0", "t4", "t13"]
  },
  Paid: {
    stage: "Paid",
    statusLabel: "Payment Received",
    nextAction: "Finalize instructor & update event details",
    ballInCourt: "Team",
    templateKeys: ["t0", "t5", "t6", "t13"]
  },
  "Sign-Ups": {
    stage: "Sign-Ups",
    statusLabel: "Awaiting Guest Sign-Ups",
    nextAction: "Monitor registrations and waivers",
    ballInCourt: "Client",
    templateKeys: ["t0", "t6", "t10", "t13", "t14"]
  },
  Confirmed: {
    stage: "Confirmed",
    statusLabel: "Sign-Ups Complete",
    nextAction: "Confirm remaining balance and prep final communication",
    ballInCourt: "Team",
    templateKeys: ["t0", "t6", "t7", "t11", "t13"]
  },
  Final: {
    stage: "Final",
    statusLabel: "Final Confirmation Sent",
    nextAction: "Prepare final event logistics",
    ballInCourt: "Team",
    templateKeys: ["t0", "t7", "t11", "t13", "t14"]
  },
  Ready: {
    stage: "Ready",
    statusLabel: "Ready for Event",
    nextAction: "Host event and capture any final changes",
    ballInCourt: "Team",
    templateKeys: ["t0", "t12", "t13", "t14"]
  },
  Complete: {
    stage: "Complete",
    statusLabel: "Event Complete",
    nextAction: "Closed",
    ballInCourt: "Team",
    templateKeys: ["t0", "t12", "t13"]
  },
  Cancelled: {
    stage: "Cancelled",
    statusLabel: "Cancelled",
    nextAction: "Closed",
    ballInCourt: "Team",
    templateKeys: ["t0", "t8", "t9", "t13"]
  },
  DOA: {
    stage: "DOA",
    statusLabel: "Dead — No Response",
    nextAction: "Closed",
    ballInCourt: "Team",
    templateKeys: ["t0", "t13"]
  },
  "Not Possible": {
    stage: "Not Possible",
    statusLabel: "Not Possible",
    nextAction: "Closed",
    ballInCourt: "Team",
    templateKeys: ["t0", "t13"]
  },
  "On Hold": {
    stage: "On Hold",
    statusLabel: "On Hold",
    nextAction: "Client to re-engage when ready",
    ballInCourt: "Client",
    templateKeys: ["t0", "t13"]
  }
};

export function getBuyoutPhase(stage: StageKey) {
  return BUYOUT_PHASES[stage];
}

export type PaymentTier = "deposit" | "standard" | "rush";

export function getPaymentTier(input: {
  inquiryDate: string | null;
  eventDate: string | null;
}): PaymentTier {
  if (!input.inquiryDate || !input.eventDate) return "standard";

  const inquiry = new Date(input.inquiryDate);
  const event = new Date(input.eventDate);

  if (isNaN(inquiry.getTime()) || isNaN(event.getTime())) return "standard";

  const daysFromInquiryToEvent = Math.ceil((event.getTime() - inquiry.getTime()) / 86400000);

  if (daysFromInquiryToEvent < 14) return "rush";
  if (daysFromInquiryToEvent < 30) return "standard";
  return "deposit";
}

export const PAYMENT_RULES = {
  deposit: {
    label: "Deposit Required (30+ days from inquiry)",
    depositRequired: true,
    depositAmount: 250,
    depositDeadline: "To hold the date",
    remainingBalanceDue: "14 days before event",
    fullPaymentOption: true,
    rushFee: 0,
    links: ["deposit", "remaining", "full"],
    note: "$250 deposit required to hold date. Remaining balance due 14 days before event. Option to pay in full upfront."
  },
  standard: {
    label: "Standard (14–30 days from inquiry)",
    depositRequired: false,
    depositAmount: 0,
    depositDeadline: null,
    remainingBalanceDue: null,
    fullPaymentOption: true,
    rushFee: 0,
    links: ["full"],
    note: "Full payment due. No deposit required — event is within 30 days of inquiry."
  },
  rush: {
    label: "Rush Event (under 14 days from inquiry)",
    depositRequired: false,
    depositAmount: 0,
    depositDeadline: null,
    remainingBalanceDue: null,
    fullPaymentOption: true,
    rushFee: 100,
    links: ["full-with-rush"],
    note: "Full payment + $100 rush coordination fee due within 48 hours of date/time confirmation. Date and time will NOT be held until payment is received."
  }
} as const;
