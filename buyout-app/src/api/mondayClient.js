/**
 * MONDAY.COM API CLIENT
 * Board: Group Buyouts (#18394979378)
 *
 * Integration options:
 *   1. Monday Vibe SDK (if running inside Monday) — use mondaySdk().api()
 *   2. Monday API v2 (GraphQL) — direct HTTP calls with API token
 *   3. Monday Apps Framework — for standalone apps with OAuth
 *
 * This module provides the GraphQL queries and mutation helpers
 * needed by the dashboard. Adapt the transport layer to your deployment.
 */

import { BOARD_ID, COLUMNS, TEMPLATE_COLUMNS } from '../config/boardColumns';

// ── Configuration ─────────────────────────────────────────────────
// In production, use environment variables or Monday SDK context.
const MONDAY_API_URL = 'https://api.monday.com/v2';

/**
 * Execute a GraphQL query against Monday.com.
 * Replace this with mondaySdk().api(query) if running as a Vibe app.
 *
 * @param {string} query - GraphQL query string
 * @param {object} variables - Query variables
 * @param {string} apiToken - Monday API token (from env or SDK)
 * @returns {Promise<object>} API response data
 */
export async function mondayQuery(query, variables = {}, apiToken) {
  const response = await fetch(MONDAY_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': apiToken,
      'API-Version': '2024-10',
    },
    body: JSON.stringify({ query, variables }),
  });
  const json = await response.json();
  if (json.errors) {
    console.error('Monday API errors:', json.errors);
    throw new Error(json.errors[0].message);
  }
  return json.data;
}

// ── Queries ───────────────────────────────────────────────────────

/**
 * Fetch all buyout items with the columns needed for the dashboard.
 * Uses column_values to get all relevant fields in one call.
 */
export const FETCH_ALL_ITEMS_QUERY = `
  query GetBuyoutItems($boardId: [ID!]!) {
    boards(ids: $boardId) {
      items_page(limit: 100) {
        items {
          id
          name
          group { id title }
          column_values {
            id
            type
            text
            value
            ... on StatusValue { index label }
            ... on DateValue { date }
            ... on NumbersValue { number }
            ... on DropdownValue { values { id } }
            ... on EmailValue { email text }
            ... on LinkValue { url text }
            ... on HourValue { hour minute }
            ... on FormulaValue { text }
            ... on LongTextValue { text }
          }
        }
      }
    }
  }
`;

/**
 * Fetch a single item with all template columns (for email preview).
 * Mirrors the Make.com ExecuteGraphQLQuery module's alias pattern.
 */
export const FETCH_ITEM_WITH_TEMPLATES_QUERY = `
  query GetItemTemplates($itemId: [ID!]!) {
    items(ids: $itemId) {
      id
      name
      column_values {
        id
        text
        value
      }
    }
  }
`;

// ── Mutations ─────────────────────────────────────────────────────

/**
 * Set the email trigger column to fire a specific template via Make.com.
 *
 * FLOW: This mutation sets color_mkzjmcth → Monday webhook fires →
 *       Make.com scenario #4639696 runs → email sent via Gmail.
 *
 * @param {string} itemId - Monday item ID
 * @param {string} triggerLabel - Exact label from EMAIL_TEMPLATES[].trigger
 */
export function buildTriggerEmailMutation(itemId, triggerLabel) {
  return {
    query: `
      mutation TriggerEmail($boardId: ID!, $itemId: ID!, $columnId: String!, $value: JSON!) {
        change_column_value(
          board_id: $boardId,
          item_id: $itemId,
          column_id: $columnId,
          value: $value
        ) { id }
      }
    `,
    variables: {
      boardId: BOARD_ID,
      itemId,
      columnId: COLUMNS.sendEmailTrigger,
      value: JSON.stringify({ label: triggerLabel }),
    },
  };
}

/**
 * Update a workflow checkbox column (Yes/No status).
 *
 * @param {string} itemId - Monday item ID
 * @param {string} columnId - Workflow column ID
 * @param {boolean} checked - true = "Yes", false = "No"
 */
export function buildWorkflowCheckMutation(itemId, columnId, checked) {
  return {
    query: `
      mutation UpdateWorkflow($boardId: ID!, $itemId: ID!, $columnId: String!, $value: JSON!) {
        change_column_value(
          board_id: $boardId,
          item_id: $itemId,
          column_id: $columnId,
          value: $value
        ) { id }
      }
    `,
    variables: {
      boardId: BOARD_ID,
      itemId,
      columnId,
      value: JSON.stringify({ index: checked ? 1 : 0 }),
    },
  };
}

/**
 * Update multiple column values on an item (e.g., editing event details).
 *
 * @param {string} itemId - Monday item ID
 * @param {object} columnValues - Object of { columnId: value } pairs
 */
export function buildUpdateItemMutation(itemId, columnValues) {
  return {
    query: `
      mutation UpdateItem($boardId: ID!, $itemId: ID!, $values: JSON!) {
        change_multiple_column_values(
          board_id: $boardId,
          item_id: $itemId,
          column_values: $values
        ) { id }
      }
    `,
    variables: {
      boardId: BOARD_ID,
      itemId,
      values: JSON.stringify(columnValues),
    },
  };
}

/**
 * Create a new buyout item in the specified group.
 *
 * @param {string} groupId - Board group ID
 * @param {string} clientName - Item name (client name)
 * @param {object} columnValues - Initial column values
 */
export function buildCreateItemMutation(groupId, clientName, columnValues = {}) {
  return {
    query: `
      mutation CreateBuyout($boardId: ID!, $groupId: String!, $name: String!, $values: JSON!) {
        create_item(
          board_id: $boardId,
          group_id: $groupId,
          item_name: $name,
          column_values: $values
        ) { id }
      }
    `,
    variables: {
      boardId: BOARD_ID,
      groupId,
      name: clientName,
      values: JSON.stringify(columnValues),
    },
  };
}
