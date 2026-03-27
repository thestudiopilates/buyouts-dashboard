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
  | "Complete"
  | "Cancelled";

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
  statusLabel: string;
  eventDate: string;
  countdownDays: number | null;
  location: string;
  assignedTo: string;
  instructor: string;
  lifecycleStage: StageKey;
  lifecycleStep: number;
  trackingHealth: TrackingKey;
  ballInCourt: BallInCourtKey;
  nextAction: string;
  daysWaiting: number;
  lastAction: string | null;
  signups: number;
  capacity: number;
  signupFillPercent: number | null;
  total: number;
  amountPaid: number;
  outstanding: number;
  paymentProgress: number;
  clientEmail: string;
  clientPhone?: string;
  startTime?: string;
  endTime?: string;
  depositLink?: string;
  balanceLink?: string;
  signupLink?: string;
  notes: string;
  workflowProgress: number;
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
