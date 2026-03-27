/**
 * BUYOUT DATA HOOK
 * Central data management for the dashboard.
 *
 * In production, this hook:
 *   1. Fetches all items from Monday board #18394979378
 *   2. Transforms raw column_values into the app's data model
 *   3. Provides filter/sort/select state
 *   4. Exposes mutation functions (trigger email, check workflow, update item)
 *
 * The data model below matches the annotated mockup's BUYOUTS array.
 * Each field has a comment mapping it to its board column ID.
 */

// import { useState, useMemo, useEffect, useCallback } from 'react';
// import { mondayQuery, FETCH_ALL_ITEMS_QUERY, buildTriggerEmailMutation } from '../api/mondayClient';
// import { BOARD_ID, COLUMNS } from '../config/boardColumns';
// import { isTerminalState } from '../config/statusLifecycle';

/**
 * DATA MODEL — shape of each buyout object after transformation.
 *
 * @typedef {Object} BuyoutItem
 * @property {string} id                    — Monday item ID
 * @property {string} name                  — Item name (client name) → board: name
 * @property {string} eventType             — Birthday/Corporate/Bachelorette → board: (new dropdown needed)
 * @property {string|null} eventDate        — ISO date → board: date_mkzjkm1t
 * @property {string} location              — Final location → board: dropdown_mkzjkhds
 * @property {string} instructor            — Instructor name → board: text_mkzg27y9
 * @property {string} assignedTo            — Front desk PM → board: (new column needed)
 * @property {string} status                — "Where Are We Now" label → board: status column
 * @property {number} si                    — Status index → board: status column index
 * @property {string} bic                   — Ball In Court → board: BIC status column
 * @property {string} dueNext               — "What's Due Next" label → board: status column
 * @property {number} total                 — Total price → board: numeric_mkzj1sfj
 * @property {number} paid                  — Amount paid → board: numeric_mm1v48qj
 * @property {number} deposit               — Deposit amount → board: numeric_mm1v472d
 * @property {number} remaining             — Remaining balance → board: formula_mm1v17wd
 * @property {number} cap                   — Class capacity → Momence / manual
 * @property {number} signups               — Current signups → Momence / manual
 * @property {number} dw                    — Days waiting since last action (derived)
 * @property {string} track                 — "How's it Tracking?" → board: color_mkzjdr77
 * @property {string|null} lastAction       — Date of last action (derived from board activity)
 * @property {string|null} startTime        — Start time → board: hour_mm0rahy6
 * @property {string|null} endTime          — End time → board: hour_mm0rrxfq
 * @property {number} hours                 — Duration → board: formula_mm1v4p39
 * @property {string} clientEmail           — Client email → board: emailoeuk5uwf
 * @property {string} ccEmails              — CC emails → board: text_mm1tnygh
 * @property {string} depositLink           — Deposit payment URL → board: link_mkzjmvqw
 * @property {string} balanceLink           — Balance payment URL → board: link_mkzjsm8r
 * @property {string} signupLink            — Momence booking URL → board: link_mkzg7k99
 * @property {string[]} emailsSent          — Template IDs already sent (e.g., ['t1','t3','t5'])
 * @property {Object} templateVars          — Resolved template variable values
 * @property {Object} workflow              — 16 checkbox states { key: boolean }
 * @property {string} notes                 — Internal PM notes
 */

/**
 * Transform raw Monday column_values into the app's BuyoutItem shape.
 *
 * @param {object} mondayItem - Raw item from Monday API
 * @returns {BuyoutItem}
 */
export function transformMondayItem(mondayItem) {
  const cols = {};
  mondayItem.column_values.forEach(cv => {
    cols[cv.id] = cv;
  });

  const getVal = (id) => cols[id]?.text || '';
  const getNum = (id) => cols[id]?.number ?? cols[id]?.text ? parseFloat(cols[id].text) : 0;
  const getDate = (id) => cols[id]?.date || null;
  const getLink = (id) => cols[id]?.url || '';
  const getEmail = (id) => cols[id]?.email || cols[id]?.text || '';
  const getStatus = (id) => ({ label: cols[id]?.label || '', index: cols[id]?.index });

  // Parse client first name from item name
  const clientFirstName = mondayItem.name.split(' ')[0];

  return {
    id: mondayItem.id,
    name: mondayItem.name,
    eventType: '', // TODO: map from new Event Type dropdown column
    eventDate: getDate('date_mkzjkm1t'),
    location: getVal('dropdown_mkzjkhds'),
    instructor: getVal('text_mkzg27y9'),
    assignedTo: '', // TODO: map from new Front Desk Assigned column
    status: getStatus(null).label, // TODO: map Where Are We Now column ID
    si: getStatus(null).index,
    bic: getStatus(null).label, // TODO: map Ball In Court column ID
    dueNext: getStatus(null).label, // TODO: map What's Due Next column ID
    total: getNum('numeric_mkzj1sfj'),
    paid: getNum('numeric_mm1v48qj'),
    deposit: getNum('numeric_mm1v472d'),
    remaining: getNum('formula_mm1v17wd'),
    cap: 0, // TODO: Momence integration or manual column
    signups: 0, // TODO: Momence integration or manual column
    dw: 0, // TODO: derive from activity log or manual lastAction field
    track: getVal('color_mkzjdr77'),
    lastAction: null,
    startTime: getVal('hour_mm0rahy6'),
    endTime: getVal('hour_mm0rrxfq'),
    hours: getNum('formula_mm1v4p39'),
    clientEmail: getEmail('emailoeuk5uwf'),
    ccEmails: getVal('text_mm1tnygh'),
    depositLink: getLink('link_mkzjmvqw'),
    balanceLink: getLink('link_mkzjsm8r'),
    signupLink: getLink('link_mkzg7k99'),
    emailsSent: [], // TODO: derive from trigger column history or sent column
    templateVars: {
      clientFirstName,
      preferredDate: getVal('date_mkzgxvy2'),
      preferredLocation: getVal('dropdown_mkzgaf3g'),
      eventDate: getVal('date_mkzjkm1t'),
      startTime: getVal('hour_mm0rahy6'),
      endTime: getVal('hour_mm0rrxfq'),
      location: getVal('dropdown_mkzjkhds'),
      instructor: getVal('text_mkzg27y9'),
      totalPrice: getVal('numeric_mkzj1sfj'),
      depositAmount: getVal('numeric_mm1v472d'),
      depositLink: getLink('link_mkzjmvqw') ? 'Y' : '',
      signupLink: getLink('link_mkzg7k99') ? 'Y' : '',
      remainingBalance: getVal('formula_mm1v17wd'),
      remainingBalanceLink: getLink('link_mkzjsm8r') ? 'Y' : '',
      amountPaid: getVal('numeric_mm1v48qj'),
      numberOfHours: getVal('formula_mm1v4p39'),
    },
    workflow: {
      // TODO: map each key to its actual Yes/No column ID
      // For now, all false — populate from board data
      inquiryReviewed: false,
      initialResponseSent: false,
      followUpSent: false,
      feasibilityConfirmed: false,
      quoteSent: false,
      depositRequested: false,
      depositReceived: false,
      eventDetailsConfirmed: false,
      signUpLinkCreated: false,
      signUpLinkSent: false,
      signUpsMonitored: false,
      finalPaymentReceived: false,
      finalConfirmationSent: false,
      dayOfPrepComplete: false,
      eventDelivered: false,
      postEventFollowUp: false,
    },
    notes: '', // TODO: map from PM Notes column when created
  };
}
