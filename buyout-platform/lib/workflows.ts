import { WorkflowStep } from "@/lib/types";

const DEFINITIONS = [
  { key: "inquiry-reviewed", label: "Inquiry Reviewed", group: "Intake" },
  { key: "initial-inquiry-response-sent", label: "Initial Response Sent", group: "Intake" },
  { key: "customer-responded", label: "Customer Responded", group: "Discussion" },
  { key: "date-finalized", label: "Date Finalized", group: "Discussion" },
  { key: "deposit-link-sent-and-terms-shared", label: "Payment Link Sent", group: "Payment" },
  { key: "deposit-paid-and-terms-signed", label: "Payment Received", group: "Payment" },
  { key: "instructor-finalized", label: "Instructor Finalized", group: "Event Setup" },
  { key: "momence-class-created", label: "Momence Class Created", group: "Event Setup" },
  { key: "momence-link-sign-up-sent", label: "Event Details Sent to Client", group: "Event Setup" },
  { key: "remaining-payment-received", label: "Remaining Balance Received", group: "Payment" },
  { key: "all-attendees-registered", label: "All Attendees Registered", group: "Registration" },
  { key: "all-waivers-signed", label: "All Waivers Signed", group: "Registration" },
  { key: "front-desk-assigned", label: "Front Desk Assigned", group: "Logistics" },
  { key: "front-desk-shift-extended", label: "Desk Shift Extended", group: "Logistics" },
  { key: "final-confirmation-emails-sent", label: "Final Confirmation Sent", group: "Pre-Event" },
  { key: "event-completed", label: "Event Completed", group: "Execution" }
] as const;

export function buildWorkflow(completedKeys: string[]): WorkflowStep[] {
  return DEFINITIONS.map((definition) => ({
    ...definition,
    complete: completedKeys.includes(definition.key)
  }));
}
