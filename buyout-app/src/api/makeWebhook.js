/**
 * MAKE.COM EMAIL TRIGGER INTEGRATION
 * Scenario: #4639696 — "Buyout Email Threading"
 * Folder: Buyout Operations (ID: 312354)
 * URL: https://us1.make.com/965901/scenarios/4639696
 *
 * The dashboard does NOT call Make.com directly.
 * Instead, it updates the Monday board's trigger column (color_mkzjmcth),
 * which fires the Monday webhook → Make.com scenario.
 *
 * This module documents the Make.com architecture and provides
 * helper functions for the email send flow.
 */

import { COLUMNS } from '../config/boardColumns';
import { EMAIL_TEMPLATES, checkVariableReadiness } from '../config/emailTemplates';

// ── Make.com Scenario Architecture ────────────────────────────────
export const MAKE_SCENARIO = {
  id: 4639696,
  name: 'Buyout Email Threading',
  folderId: 312354,
  url: 'https://us1.make.com/965901/scenarios/4639696',

  modules: [
    {
      position: 1,
      type: 'Monday Webhook (instant)',
      hookId: 2663435,
      details: 'Watches color_mkzjmcth changes on board 18394979378. Filter: non-empty labels only.',
    },
    {
      position: 2,
      type: 'Monday ExecuteGraphQLQuery',
      details: 'Fetches item name + all 14 template columns via aliases (t1–t14) + dateCol + emailCol + instructorEmail + ccCol. Replaced GetItem module which cannot fetch long_text at runtime.',
    },
    {
      position: 3,
      type: 'Gmail Send',
      connectionId: 4719260,
      from: 'events@thestudiopilates.com',
      details: 'To: dynamic from emailCol. CC: ccCol with ifempty() null handling. Subject includes item name + formatted date. Body from switch() mapping trigger label → template alias. Line breaks via replace(newline, "<br>") in styled HTML div.',
    },
    {
      position: 4,
      type: 'Monday UpdateColumns',
      details: 'Stores Gmail messageId to text_mm1ttgb7 (Email Thread ID) + text_mm1t1dgy (Email Message ID). Enables threading by subject match.',
    },
  ],

  connections: {
    monday: { id: 3941894, name: 'Monday Conflict Checker' },
    gmailEvents: { id: 4719260, name: 'events@thestudiopilates.com' },
    gmailKelly: { id: 4712300, name: 'kelly@thestudiopilates.com (not used in scenario)' },
  },
};

// ── Email Send Flow ───────────────────────────────────────────────

/**
 * Validate and prepare an email send action.
 * Does NOT actually send — just validates readiness and returns the
 * trigger label to set on the board column.
 *
 * @param {string} templateId - Template ID (e.g., 't1', 't5')
 * @param {object} itemData - Board item data with column values
 * @returns {{ canSend: boolean, triggerLabel: string|null, triggerColumnId: string, errors: string[] }}
 */
export function prepareEmailSend(templateId, itemData) {
  const template = EMAIL_TEMPLATES.find(t => t.id === templateId);
  if (!template) {
    return { canSend: false, triggerLabel: null, triggerColumnId: null, errors: ['Template not found'] };
  }

  const readiness = checkVariableReadiness(template, itemData);
  const errors = [];

  if (!readiness.ready) {
    errors.push(`Missing variables: ${readiness.missing.join(', ')}`);
  }

  // Check for client email
  if (!itemData.clientEmail) {
    errors.push('Client email (emailoeuk5uwf) is empty — email has no recipient');
  }

  // Warn about t13 dual-purpose issue
  if (templateId === 't13') {
    errors.push('WARNING: t13 column is dual-purpose (also conversation log). Sending will include entire history. Split planned.');
  }

  return {
    canSend: errors.length === 0 || (errors.length === 1 && templateId === 't13'),
    triggerLabel: template.trigger,
    triggerColumnId: COLUMNS.sendEmailTrigger,
    errors,
  };
}

/**
 * After triggering an email, the trigger column should be reset.
 * This prevents re-sending if the webhook fires again.
 *
 * NOTE: This reset is not yet implemented in the Vibe app.
 * The Vibe app should clear color_mkzjmcth before re-setting it.
 * This is a known issue (see CLAUDE.md — Medium Term tasks).
 *
 * @returns {string} Empty label value to clear the trigger column
 */
export function getResetTriggerValue() {
  return JSON.stringify({ label: '' });
}
