/**
 * 14 EMAIL TEMPLATES — Make.com Scenario #4639696
 *
 * SEND FLOW:
 *   1. Dashboard "Send" button sets board column color_mkzjmcth to trigger label
 *   2. Monday webhook (hookId: 2663435) fires instantly
 *   3. Make.com ExecuteGraphQLQuery fetches item via aliases (t1–t14)
 *   4. switch() maps trigger label → aliased template long_text column
 *   5. Gmail sends from events@thestudiopilates.com (connection: 4719260)
 *   6. Subject: "The Studio Pilates Buyout: [Client Name] | [Month Day, Year]"
 *   7. Gmail messageId stored back to board (text_mm1ttgb7 + text_mm1t1dgy)
 *
 * VARIABLE REPLACEMENT:
 *   Templates contain {{Variable Name}} placeholders.
 *   The Vibe app's emailVariableReplacer.js (replaceVariables()) swaps these
 *   with board column values BEFORE writing to the long_text column.
 *   Make.com does NOT do variable replacement — it sends the column content as-is.
 *
 * VALIDATION GAP:
 *   Currently no check in Make.com for unresolved {{placeholders}}.
 *   The varReady() function in the dashboard checks readiness client-side,
 *   but a server-side filter should be added to Make.com (planned).
 */

import { TEMPLATE_COLUMNS, COLUMNS } from './boardColumns';

export const EMAIL_TEMPLATES = [
  {
    id: 't1',
    label: 'First Inquiry Email',
    trigger: 'First Inquiry Email Sent',
    column: TEMPLATE_COLUMNS.t1,
    phase: 'Intake',
    requiredVars: [
      { name: 'Client First Name', columnId: 'name', key: 'clientFirstName' },
      { name: 'Preferred Date',    columnId: COLUMNS.preferredDate1, key: 'preferredDate' },
      { name: 'Preferred Location', columnId: COLUMNS.preferredLocation, key: 'preferredLocation' },
    ],
    description: 'Initial response to new buyout inquiry. Confirms receipt and outlines next steps.',
  },
  {
    id: 't2',
    label: 'Food & Beverage Policy',
    trigger: 'Clarify Food Beverage Policy',
    column: TEMPLATE_COLUMNS.t2,
    phase: 'Intake',
    requiredVars: [
      { name: 'Client First Name', columnId: 'name', key: 'clientFirstName' },
    ],
    description: 'Sent when client asks about food/beverage at the studio.',
  },
  {
    id: 't3',
    label: 'Deposit & Date',
    trigger: 'Deposit & Date Email',
    column: TEMPLATE_COLUMNS.t3,
    phase: 'Planning',
    requiredVars: [
      { name: 'Client First Name', columnId: 'name', key: 'clientFirstName' },
      { name: 'Event Date',        columnId: COLUMNS.finalizedDate, key: 'eventDate' },
      { name: 'Location',          columnId: COLUMNS.finalLocation, key: 'location' },
      { name: 'Total Price',       columnId: COLUMNS.totalPrice, key: 'totalPrice' },
      { name: 'Deposit Amount',    columnId: COLUMNS.depositAmount, key: 'depositAmount' },
      { name: 'Deposit Link',      columnId: COLUMNS.depositLink, key: 'depositLink' },
    ],
    description: 'Confirms date, location, pricing. Includes deposit payment link.',
  },
  {
    id: 't4',
    label: 'Deposit Reminder',
    trigger: 'Deposit Reminder Email',
    column: TEMPLATE_COLUMNS.t4,
    phase: 'Payment',
    requiredVars: [
      { name: 'Client First Name', columnId: 'name', key: 'clientFirstName' },
      { name: 'Deposit Amount',    columnId: COLUMNS.depositAmount, key: 'depositAmount' },
      { name: 'Deposit Link',      columnId: COLUMNS.depositLink, key: 'depositLink' },
    ],
    description: 'Follow-up if deposit not received after initial email.',
  },
  {
    id: 't5',
    label: 'Event Details & Sign Up',
    trigger: 'Event Details & Sign Up',
    column: TEMPLATE_COLUMNS.t5,
    phase: 'Logistics',
    requiredVars: [
      { name: 'Client First Name', columnId: 'name', key: 'clientFirstName' },
      { name: 'Event Date',        columnId: COLUMNS.finalizedDate, key: 'eventDate' },
      { name: 'Start Time',        columnId: COLUMNS.startTime, key: 'startTime' },
      { name: 'End Time',          columnId: COLUMNS.endTime, key: 'endTime' },
      { name: 'Location',          columnId: COLUMNS.finalLocation, key: 'location' },
      { name: 'Instructor',        columnId: COLUMNS.instructor, key: 'instructor' },
      { name: 'Signup Link',       columnId: COLUMNS.signupLink, key: 'signupLink' },
    ],
    description: 'Full event details with Momence sign-up link for guests.',
  },
  {
    id: 't6',
    label: 'Second Half Payment',
    trigger: 'Second Half Payment Email',
    column: TEMPLATE_COLUMNS.t6,
    phase: 'Payment',
    requiredVars: [
      { name: 'Client First Name',      columnId: 'name', key: 'clientFirstName' },
      { name: 'Remaining Balance',       columnId: COLUMNS.remainingBalance, key: 'remainingBalance' },
      { name: 'Remaining Balance Link',  columnId: COLUMNS.balanceLink, key: 'remainingBalanceLink' },
    ],
    description: 'Requests remaining balance payment after deposit received.',
  },
  {
    id: 't7',
    label: 'Balance Reminder',
    trigger: 'Remaining Balance Reminder',
    column: TEMPLATE_COLUMNS.t7,
    phase: 'Payment',
    requiredVars: [
      { name: 'Client First Name',      columnId: 'name', key: 'clientFirstName' },
      { name: 'Remaining Balance',       columnId: COLUMNS.remainingBalance, key: 'remainingBalance' },
      { name: 'Remaining Balance Link',  columnId: COLUMNS.balanceLink, key: 'remainingBalanceLink' },
    ],
    description: 'Follow-up reminder for outstanding balance.',
  },
  {
    id: 't8',
    label: 'Cancelled (No Refund)',
    trigger: 'Event Cancelled (No Refund)',
    column: TEMPLATE_COLUMNS.t8,
    phase: 'Terminal',
    requiredVars: [
      { name: 'Client First Name', columnId: 'name', key: 'clientFirstName' },
    ],
    description: 'Cancellation notification — deposit forfeited per policy.',
  },
  {
    id: 't9',
    label: 'Cancelled (Refund)',
    trigger: 'Event Cancelled (Refund)',
    column: TEMPLATE_COLUMNS.t9,
    phase: 'Terminal',
    requiredVars: [
      { name: 'Client First Name', columnId: 'name', key: 'clientFirstName' },
      { name: 'Deposit Amount',    columnId: COLUMNS.depositAmount, key: 'depositAmount' },
    ],
    description: 'Cancellation notification with refund confirmation.',
  },
  {
    id: 't10',
    label: 'Missing Signups',
    trigger: 'Missing Signups Email',
    column: TEMPLATE_COLUMNS.t10,
    phase: 'Logistics',
    requiredVars: [
      { name: 'Client First Name', columnId: 'name', key: 'clientFirstName' },
      { name: 'Event Date',        columnId: COLUMNS.finalizedDate, key: 'eventDate' },
      { name: 'Signup Link',       columnId: COLUMNS.signupLink, key: 'signupLink' },
    ],
    description: 'Nudge to client when guest sign-up count is below capacity.',
  },
  {
    id: 't11',
    label: 'Final Confirmation',
    trigger: 'Final Confirmation Email',
    column: TEMPLATE_COLUMNS.t11,
    phase: 'Pre-Event',
    requiredVars: [
      { name: 'Client First Name', columnId: 'name', key: 'clientFirstName' },
      { name: 'Event Date',        columnId: COLUMNS.finalizedDate, key: 'eventDate' },
      { name: 'Start Time',        columnId: COLUMNS.startTime, key: 'startTime' },
      { name: 'End Time',          columnId: COLUMNS.endTime, key: 'endTime' },
      { name: 'Location',          columnId: COLUMNS.finalLocation, key: 'location' },
      { name: 'Instructor',        columnId: COLUMNS.instructor, key: 'instructor' },
    ],
    description: 'Final details confirmation ~7 days before event.',
  },
  {
    id: 't12',
    label: 'Event Complete',
    trigger: 'Event Complete',
    column: TEMPLATE_COLUMNS.t12,
    phase: 'Execution',
    requiredVars: [
      { name: 'Client First Name', columnId: 'name', key: 'clientFirstName' },
    ],
    description: 'Post-event thank you and feedback request.',
  },
  {
    id: 't13',
    label: 'Ongoing Discussion',
    trigger: 'Ongoing Discussion Email',
    column: TEMPLATE_COLUMNS.t13,
    phase: 'Any',
    requiredVars: [
      { name: 'Client First Name', columnId: 'name', key: 'clientFirstName' },
    ],
    description: 'Ad-hoc communication. WARNING: dual-purpose column — also used as conversation log. Sending triggers entire history. Split planned.',
  },
  {
    id: 't14',
    label: '48-Hour Missing Signups',
    trigger: '48-Hour Missing Signups',
    column: TEMPLATE_COLUMNS.t14,
    phase: 'Logistics',
    requiredVars: [
      { name: 'Client First Name', columnId: 'name', key: 'clientFirstName' },
      { name: 'Event Date',        columnId: COLUMNS.finalizedDate, key: 'eventDate' },
      { name: 'Signup Link',       columnId: COLUMNS.signupLink, key: 'signupLink' },
    ],
    description: 'Urgent signup reminder 48 hours before event.',
  },
];

/**
 * Check if all required variables are populated for a template.
 * @param {object} template - One of EMAIL_TEMPLATES
 * @param {object} itemData - Board item data with column values
 * @returns {{ filled: number, total: number, ready: boolean, missing: string[] }}
 */
export function checkVariableReadiness(template, itemData) {
  const missing = [];
  let filled = 0;

  template.requiredVars.forEach(v => {
    const value = itemData[v.key];
    if (value && value !== '' && value !== '0' && value !== '$0') {
      filled++;
    } else {
      missing.push(v.name);
    }
  });

  return {
    filled,
    total: template.requiredVars.length,
    ready: filled === template.requiredVars.length,
    missing,
  };
}
