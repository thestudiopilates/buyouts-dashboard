/**
 * 16 WORKFLOW CHECKBOX STEPS
 *
 * Each maps to a Yes/No status column on Monday.com board #18394979378.
 * Grouped into 6 operational phases for the Checklist tab.
 *
 * AUTOMATION PLAN (not yet implemented):
 *   When "Where Are We Now" status changes, these should auto-check
 *   via Monday automations. Currently managed manually — leads to drift.
 *   Example: When status → "Deposit Received", auto-check depositRequested + depositReceived.
 */

export const WORKFLOW_STEPS = [
  // ── INTAKE ──
  { key: 'inquiryReviewed',      label: 'Inquiry Reviewed',         group: 'Intake',     emailTrigger: null },
  { key: 'initialResponseSent',  label: 'Initial Response Sent',    group: 'Intake',     emailTrigger: 't1' },
  { key: 'followUpSent',         label: 'Follow-Up Sent',           group: 'Intake',     emailTrigger: 't2' },

  // ── PLANNING ──
  { key: 'feasibilityConfirmed', label: 'Feasibility Confirmed',    group: 'Planning',   emailTrigger: null },
  { key: 'quoteSent',            label: 'Quote Sent',               group: 'Planning',   emailTrigger: 't3' },

  // ── PAYMENT ──
  { key: 'depositRequested',     label: 'Deposit Requested',        group: 'Payment',    emailTrigger: 't3' },
  { key: 'depositReceived',      label: 'Deposit Received',         group: 'Payment',    emailTrigger: null },
  { key: 'finalPaymentReceived', label: 'Final Payment Received',   group: 'Payment',    emailTrigger: null },

  // ── LOGISTICS ──
  { key: 'eventDetailsConfirmed',label: 'Event Details Confirmed',  group: 'Logistics',  emailTrigger: null },
  { key: 'signUpLinkCreated',    label: 'Sign-Up Link Created',     group: 'Logistics',  emailTrigger: null },
  { key: 'signUpLinkSent',       label: 'Sign-Up Link Sent',        group: 'Logistics',  emailTrigger: 't5' },
  { key: 'signUpsMonitored',     label: 'Sign-Ups Monitored',       group: 'Logistics',  emailTrigger: 't10' },

  // ── PRE-EVENT ──
  { key: 'finalConfirmationSent',label: 'Final Confirmation Sent',  group: 'Pre-Event',  emailTrigger: 't11' },
  { key: 'dayOfPrepComplete',    label: 'Day-Of Prep Complete',     group: 'Pre-Event',  emailTrigger: null },

  // ── EXECUTION ──
  { key: 'eventDelivered',       label: 'Event Delivered',          group: 'Execution',  emailTrigger: null },
  { key: 'postEventFollowUp',    label: 'Post-Event Follow-Up',     group: 'Execution',  emailTrigger: 't12' },
];

export const PHASE_ORDER = ['Intake', 'Planning', 'Payment', 'Logistics', 'Pre-Event', 'Execution'];

export const PHASE_COLORS = {
  Intake:      '#006976', // Seaglass
  Planning:    '#797F5D', // Sage
  Payment:     '#9F543F', // Terracotta
  Logistics:   '#A1B1A4', // Sky
  'Pre-Event': '#F2A408', // Sunshine
  Execution:   '#E0800E', // Apricot
};

/**
 * Get workflow steps grouped by phase.
 * @returns {Array<{ phase: string, color: string, steps: Array }>}
 */
export function getGroupedSteps() {
  return PHASE_ORDER.map(phase => ({
    phase,
    color: PHASE_COLORS[phase],
    steps: WORKFLOW_STEPS.filter(s => s.group === phase),
  }));
}

/**
 * Calculate workflow completion stats.
 * @param {object} workflowState - Object with step keys → boolean values
 * @returns {{ done: number, total: number, percentage: number }}
 */
export function getWorkflowStats(workflowState) {
  const total = WORKFLOW_STEPS.length;
  const done = WORKFLOW_STEPS.filter(s => workflowState[s.key]).length;
  return { done, total, percentage: Math.round((done / total) * 100) };
}
