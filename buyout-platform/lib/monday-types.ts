export type MondayColumnValue = {
  id: string;
  text?: string | null;
  value?: string | null;
  type?: string | null;
};

export type MondayItem = {
  id: string;
  name: string;
  column_values: MondayColumnValue[];
};

export type MondayBoardExport = {
  items: MondayItem[];
};

export type MondayImportRecord = {
  legacyMondayItemId: string;
  displayName: string;
  clientName: string;
  clientEmail?: string;
  ccEmails?: string;
  companyName?: string;
  eventType?: string;
  preferredDates?: string;
  preferredLocation?: string;
  finalLocation?: string;
  eventDate?: string;
  startTime?: string;
  endTime?: string;
  instructorName?: string;
  lifecycleStage: string;
  trackingHealth: string;
  ballInCourt: string;
  nextAction?: string;
  totalPrice?: number;
  amountPaid?: number;
  depositAmount?: number;
  remainingBalance?: number;
  depositLink?: string;
  balanceLink?: string;
  signupLink?: string;
  emailThreadId?: string;
  emailMessageId?: string;
  notes?: string;
  templateBodies: Record<string, string>;
  workflowStepKeys: string[];
};
