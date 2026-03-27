/**
 * MONDAY.COM BOARD COLUMN REGISTRY
 * Board: Group Buyouts (#18394979378)
 *
 * Every column ID used by the Buyout Operations system.
 * This is the single source of truth — all components import from here.
 *
 * Column ID format: {type}_{hash}
 *   - date_  = Date column
 *   - text_  = Text column
 *   - numeric_ = Number column
 *   - formula_ = Formula column
 *   - dropdown_ = Dropdown column
 *   - color_ = Status column
 *   - link_  = Link column
 *   - email  = Email column (note: no underscore prefix on some)
 *   - hour_  = Hour column
 *   - long_text_ = Long Text column (used for email templates)
 */

export const BOARD_ID = '18394979378';

// ── Core Item Fields ──────────────────────────────────────────────
export const COLUMNS = {
  // Client info
  clientName:       'name',                // Item name — first word parsed as first name
  clientEmail:      'emailoeuk5uwf',       // "Your Email"
  ccEmails:         'text_mm1tnygh',       // "CC Emails" — used in Make.com Gmail CC field
  phone:            null,                  // Not yet on board — manual tracking

  // Event details
  preferredDate1:   'date_mkzgxvy2',       // "Preferred Class Date 1"
  finalizedDate:    'date_mkzjkm1t',       // "Finalized Class Date" — primary event date
  startTime:        'hour_mm0rahy6',       // "Start Time"
  endTime:          'hour_mm0rrxfq',       // "End Time"
  preferredLocation:'dropdown_mkzgaf3g',   // "Preferred Location"
  finalLocation:    'dropdown_mkzjkhds',   // "Final Location"
  instructor:       'text_mkzg27y9',       // "Instructor Claimed"
  instructorEmail:  'email_mkzjh6b9',      // "Instructor Email"
  assignedTo:       null,                  // "Front Desk Assigned" — NEW COLUMN NEEDED

  // Financial
  totalPrice:       'numeric_mkzj1sfj',    // "Total Price"
  amountPaid:       'numeric_mm1v48qj',    // "Amount Paid"
  depositAmount:    'numeric_mm1v472d',    // "Deposit Amount"
  remainingBalance: 'formula_mm1v17wd',    // "Remaining Balance" = MINUS(totalPrice, amountPaid)
  numberOfHours:    'formula_mm1v4p39',    // "Number of Hours" = DIVIDE(numeric_mkzj6seb, 60)

  // Links
  depositLink:      'link_mkzjmvqw',       // "Buyout Deposit Link"
  balanceLink:      'link_mkzjsm8r',       // "Remaining Balance Payment Link"
  signupLink:       'link_mkzg7k99',       // "Live Class Link" (Momence)

  // Status columns
  whereAreWeNow:    null,                  // Status column — "Where Are We Now" (23 labels + legacy)
  whatsDueNext:     null,                  // Status column — "What's Due Next" (26 labels)
  ballInCourt:      null,                  // Status column — "Ball In Court" (TSP Team / Client / Both)
  howsItTracking:   'color_mkzjdr77',      // "How's it Tracking?" — KNOWN BUG: "v" instead of "No"

  // Email system
  sendEmailTrigger: 'color_mkzjmcth',     // "Send Email Trigger" — 14 status labels trigger Make.com
  emailThreadId:    'text_mm1ttgb7',       // Stores Gmail thread/message ID
  emailMessageId:   'text_mm1t1dgy',       // Stores Gmail message ID
};

// ── Email Template Long Text Columns ──────────────────────────────
// Each stores the HTML template body for one email.
// Populated per-item on the board; read by Make.com via GraphQL aliases t1–t14.
export const TEMPLATE_COLUMNS = {
  t1:  'long_text_mkzjxtpp',  // First Inquiry Email
  t2:  'long_text_mkzjd66k',  // Clarify Food Beverage Policy
  t3:  'long_text_mkzjwxsh',  // Deposit & Date Email
  t4:  'long_text_mkzjpmj',   // Deposit Reminder Email
  t5:  'long_text_mkzjfbe9',  // Event Details & Sign Up
  t6:  'long_text_mkzj7sj5',  // Second Half Payment Email
  t7:  'long_text_mkzjemea',  // Remaining Balance Reminder
  t8:  'long_text_mkzj2qt0',  // Event Cancelled (No Refund)
  t9:  'long_text_mkzj6xcc',  // Event Cancelled (Refund)
  t10: 'long_text_mkzj45br',  // Missing Signups Email
  t11: 'long_text_mkzj6cy5',  // Final Confirmation Email
  t12: 'long_text_mkzjab4d',  // Event Complete
  t13: 'long_text_mkzj14vc',  // Ongoing Discussion — DUAL PURPOSE (also conversation log)
  t14: 'long_text_mkzjw24h',  // 48-Hour Missing Signups
};

// ── 16 Workflow Checkbox Columns ──────────────────────────────────
// Each is a Yes/No status column on the board.
// Key = camelCase used in app state; value = Monday column ID.
// NOTE: Exact column IDs for these Yes/No columns need to be verified
// via Monday API — they weren't individually documented in prior work.
export const WORKFLOW_COLUMNS = {
  inquiryReviewed:      null, // TODO: fetch via get_board_info
  initialResponseSent:  null,
  followUpSent:         null,
  feasibilityConfirmed: null,
  quoteSent:            null,
  depositRequested:     null,
  depositReceived:      null,
  eventDetailsConfirmed:null,
  signUpLinkCreated:    null,
  signUpLinkSent:       null,
  signUpsMonitored:     null,
  finalPaymentReceived: null,
  finalConfirmationSent:null,
  dayOfPrepComplete:    null,
  eventDelivered:       null,
  postEventFollowUp:    null,
};

// ── New Columns Needed ────────────────────────────────────────────
// These should be created on the board before app launch.
export const COLUMNS_TO_CREATE = [
  { title: 'Front Desk Assigned', type: 'text', purpose: 'Staff routing and filtering' },
  { title: 'Event Type', type: 'dropdown', purpose: 'Filter by event type (Birthday, Corporate, Bachelorette, etc.)' },
  { title: 'Outgoing Email Draft', type: 'long_text', purpose: 'Split from t13 — dedicated draft column separate from conversation log' },
  { title: 'PM Notes', type: 'long_text', purpose: 'Internal operational notes per buyout' },
];
