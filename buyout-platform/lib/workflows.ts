import { WorkflowStep } from "@/lib/types";

const DEFINITIONS = [
  { key: "inquiry-reviewed", label: "Inquiry Reviewed", group: "Intake" },
  { key: "initial-response", label: "Initial Response Sent", group: "Intake" },
  { key: "follow-up", label: "Follow-Up Sent", group: "Intake" },
  { key: "feasibility", label: "Feasibility Confirmed", group: "Planning" },
  { key: "quote", label: "Quote Sent", group: "Planning" },
  { key: "deposit-requested", label: "Deposit Requested", group: "Payment" },
  { key: "deposit-received", label: "Deposit Received", group: "Payment" },
  { key: "details-confirmed", label: "Event Details Confirmed", group: "Logistics" },
  { key: "signup-link-created", label: "Sign-Up Link Created", group: "Logistics" },
  { key: "signup-link-sent", label: "Sign-Up Link Sent", group: "Logistics" },
  { key: "signups-monitored", label: "Sign-Ups Monitored", group: "Logistics" },
  { key: "final-payment", label: "Final Payment Received", group: "Payment" },
  { key: "final-confirmation", label: "Final Confirmation Sent", group: "Pre-Event" },
  { key: "prep-complete", label: "Day-Of Prep Complete", group: "Pre-Event" },
  { key: "event-delivered", label: "Event Delivered", group: "Execution" },
  { key: "follow-up-complete", label: "Post-Event Follow-Up", group: "Execution" }
] as const;

export function buildWorkflow(completedKeys: string[]): WorkflowStep[] {
  return DEFINITIONS.map((definition) => ({
    ...definition,
    complete: completedKeys.includes(definition.key)
  }));
}
