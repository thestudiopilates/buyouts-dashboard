import { BuyoutSummary } from "@/lib/types";
import { buildWorkflow } from "@/lib/workflows";

export const mockBuyouts: BuyoutSummary[] = [
  {
    id: "bo_sarah_chen",
    name: "Sarah Chen",
    eventType: "Birthday",
    eventDate: "2026-04-15",
    location: "1583 Decatur",
    assignedTo: "Autumn",
    lifecycleStage: "Sign-Ups",
    trackingHealth: "On track",
    ballInCourt: "Client",
    nextAction: "Check on fill",
    signups: 12,
    capacity: 20,
    total: 1200,
    amountPaid: 600,
    notes: "Client wants light food and champagne guidance.",
    workflow: buildWorkflow([
      "inquiry-reviewed",
      "initial-response",
      "follow-up",
      "feasibility",
      "quote",
      "deposit-requested",
      "deposit-received",
      "details-confirmed",
      "signup-link-created",
      "signup-link-sent"
    ])
  },
  {
    id: "bo_mike_torres",
    name: "Mike Torres",
    eventType: "Corporate",
    eventDate: "2026-04-08",
    location: "763 Trabert",
    assignedTo: "Kelly",
    lifecycleStage: "Deposit",
    trackingHealth: "At risk",
    ballInCourt: "Team",
    nextAction: "Secure instructor",
    signups: 0,
    capacity: 30,
    total: 2400,
    amountPaid: 1200,
    notes: "Corporate team event. Instructor assignment is still open.",
    workflow: buildWorkflow([
      "inquiry-reviewed",
      "initial-response",
      "feasibility",
      "quote",
      "deposit-requested",
      "deposit-received"
    ])
  },
  {
    id: "bo_jenna_woodall",
    name: "Jenna Woodall",
    eventType: "Bachelorette",
    eventDate: "2026-04-02",
    location: "1581 Decatur",
    assignedTo: "Autumn",
    lifecycleStage: "Final",
    trackingHealth: "On track",
    ballInCourt: "Client",
    nextAction: "Final attendance check",
    signups: 15,
    capacity: 15,
    total: 900,
    amountPaid: 900,
    notes: "Fully paid and nearly complete. Final confirmation has been sent.",
    workflow: buildWorkflow([
      "inquiry-reviewed",
      "initial-response",
      "feasibility",
      "quote",
      "deposit-requested",
      "deposit-received",
      "details-confirmed",
      "signup-link-created",
      "signup-link-sent",
      "signups-monitored",
      "final-payment",
      "final-confirmation"
    ])
  }
];
