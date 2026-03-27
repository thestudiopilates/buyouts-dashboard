export type StageKey =
  | "Inquiry"
  | "Respond"
  | "Discuss"
  | "Feasible"
  | "Quote"
  | "Deposit"
  | "Paid"
  | "Sign-Ups"
  | "Confirmed"
  | "Final"
  | "Ready"
  | "Complete";

export type TrackingKey = "On track" | "At risk" | "Major issue" | "Complete";
export type BallInCourtKey = "Team" | "Client" | "Both";

export type WorkflowStep = {
  key: string;
  label: string;
  group: string;
  complete: boolean;
};

export type BuyoutSummary = {
  id: string;
  name: string;
  eventType: string;
  eventDate: string;
  location: string;
  assignedTo: string;
  lifecycleStage: StageKey;
  trackingHealth: TrackingKey;
  ballInCourt: BallInCourtKey;
  nextAction: string;
  signups: number;
  capacity: number;
  total: number;
  amountPaid: number;
  notes: string;
  workflow: WorkflowStep[];
};

export type BuyoutInquiryInput = {
  clientName: string;
  clientEmail: string;
  clientPhone?: string;
  companyName?: string;
  eventType?: string;
  preferredDates?: string;
  preferredLocation?: string;
  guestCountEstimate?: number;
  notes?: string;
};
