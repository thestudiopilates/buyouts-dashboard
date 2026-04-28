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
  | "Cancelled"
  | "DOA"
  | "Not Possible"
  | "On Hold";

export type TrackingKey = "On track" | "At risk" | "Major issue" | "Complete";
export type BallInCourtKey = "Team" | "Client" | "Both";

export type WorkflowStep = {
  key: string;
  label: string;
  group: string;
  complete: boolean;
};

export type PaymentRecord = {
  id: string;
  createdAt: string;
  processedAt: string | null;
  orderNumber: string;
  clientName: string;
  clientEmail: string;
  amount: number;
  paymentMethod: string;
  productName: string;
  rawSubject: string;
  gmailMessageId: string;
  matchedBy: string | null;
  isManual?: boolean;
  notes?: string;
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
  numberOfHours?: number;
  clientName: string;
  clientEmail: string;
  clientPhone?: string;
  startTime?: string;
  endTime?: string;
  preferredDates?: string;
  preferredLocation?: string;
  guestCountEstimate?: number;
  depositAmount?: number;
  depositLink?: string;
  balanceLink?: string;
  signupLink?: string;
  signupLink2?: string;
  notes: string;
  healthFlags: string[];
  sentTemplateIds: string[];
  inquiryDate: string | null;
  lastClientContact: string | null;
  responseUrgency: "on-track" | "needs-attention" | "overdue" | "critical" | null;
  paymentTier: "deposit" | "standard" | "rush";
  paymentStructure?: "deposit-balance" | "standard" | "rush" | "custom";
  rushFee: number;
  workflowProgress: number;
  workflow: WorkflowStep[];
};

export type BuyoutInquiryInput = {
  clientName: string;
  clientEmail: string;
  clientPhone?: string;
  companyName?: string;
  eventType?: string;
  preferredDate?: string;
  preferredTime?: string;
  preferredDates?: string;
  preferredLocation?: string;
  guestCountEstimate?: number;
  duration?: string;
  notes?: string;
};

export type BuyoutUpdateInput = {
  clientName: string;
  clientEmail: string;
  clientPhone?: string;
  eventType?: string;
  preferredDates?: string;
  preferredLocation?: string;
  guestCountEstimate?: number;
  eventDate?: string;
  startTime?: string;
  endTime?: string;
  location?: string;
  capacity?: number;
  assignedTo?: string;
  instructor?: string;
  notes?: string;
  depositLink?: string;
  balanceLink?: string;
  signupLink?: string;
  signupLink2?: string;
};
