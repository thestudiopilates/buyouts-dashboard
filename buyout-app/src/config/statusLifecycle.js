/**
 * "WHERE ARE WE NOW" STATUS LIFECYCLE
 *
 * Maps the board's "Where Are We Now" status column index values
 * to a 12-step visual lifecycle bar.
 *
 * Board column: status type, 23 active labels + 19 legacy labels.
 * New lifecycle uses indices 105–157. Legacy indices still active for older items.
 *
 * TERMINAL STATES: Items in these states are "done" — hidden from the
 * default dashboard view. Toggle "Show Completed" to reveal them.
 */

// ── 12 display steps shown in the Lifecycle progress bar ──────────
export const LIFECYCLE_STEPS = [
  'Inquiry',    // Step 0 — New inquiry received
  'Respond',    // Step 1 — Initial response sent
  'Discuss',    // Step 2 — Follow-up / negotiation
  'Feasible',   // Step 3 — Date/location confirmed feasible
  'Quote',      // Step 4 — Quote and deposit details sent
  'Deposit',    // Step 5 — Deposit received
  'Paid',       // Step 6 — Full payment received
  'Sign-Ups',   // Step 7 — Awaiting guest registrations
  'Confirmed',  // Step 8 — Sign-ups complete
  'Final',      // Step 9 — Final confirmation sent
  'Ready',      // Step 10 — Day-of prep done
  'Complete',   // Step 11 — Event delivered
];

// ── Status index → Lifecycle step mapping ─────────────────────────
// Key = "Where Are We Now" status column index value
// Value = Lifecycle step number (0-11)
export const STATUS_TO_STEP = {
  106: 0,   // New Inquiry Received
  107: 1,   // Initial Response Sent
  108: 2,   // Follow Up Sent
  109: 3,   // Feasibility Confirmed
  110: 4,   // Quote Sent
  151: 5,   // Deposit Received
  152: 6,   // Payment Complete
  153: 7,   // Awaiting Guest Sign-Ups
  154: 8,   // Sign-Ups Complete
  155: 9,   // Final Confirmation Sent
  156: 10,  // Ready for Event
  15:  11,  // Event Complete (legacy index)
};

// ── Terminal states (hidden from default view) ────────────────────
export const TERMINAL_STATES = [
  15,   // Event Complete (legacy)
  105,  // (reserved)
  157,  // Cancelled
  17,   // Event Cancelled (No Refund) — legacy
  18,   // Event Cancelled (Refund) — legacy
];

// ── "What's Due Next" common labels ───────────────────────────────
// These are the most common values in the "What's Due Next" status column.
// Used for display and filtering.
export const DUE_NEXT_LABELS = [
  'Review Inquiry',
  'Send Initial Response',
  'Follow Up with Client',
  'Confirm Feasibility',
  'Send Quote',
  'Waiting for Deposit',
  'Secure Instructor',
  'Create Sign-Up Link',
  'Send Sign-Up Link',
  'Check on Fill',
  'Request Final Payment',
  'Send Final Confirmation',
  'Day-Of Prep',
  'Final Emails',
  '7-Day Check',
  'Waiting on Client',
  'Done',
];

// ── "Ball In Court" values ────────────────────────────────────────
export const BALL_IN_COURT = {
  TSP_TEAM: 'TSP Team',
  CLIENT:   'Client',
  BOTH:     'Both',
};

// ── "How's it Tracking?" values ───────────────────────────────────
// KNOWN BUG: Default is index 5 ("Complete") for new items — should be 0.
// KNOWN BUG: "v" instead of "No" for the negative label.
export const TRACKING_STATUS = {
  ON_TRACK:       'So far so good',  // index 0
  RUNNING_BEHIND: 'Running behind',  // index 1
  MAJOR_ISSUE:    'Major issue',     // index 2
  COMPLETE:       'Complete',        // index 5
};

/**
 * Get lifecycle step from status index.
 * @param {number} statusIndex - "Where Are We Now" status column index
 * @returns {number} Step number (0-11) or -1 if unknown
 */
export function getLifecycleStep(statusIndex) {
  return STATUS_TO_STEP[statusIndex] ?? -1;
}

/**
 * Check if a status index represents a terminal (completed/cancelled) state.
 * @param {number} statusIndex
 * @returns {boolean}
 */
export function isTerminalState(statusIndex) {
  return TERMINAL_STATES.includes(statusIndex);
}
