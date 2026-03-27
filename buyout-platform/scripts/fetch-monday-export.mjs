import fs from "node:fs/promises";
import path from "node:path";

const MONDAY_API_URL = "https://api.monday.com/v2";
const BOARD_ID = "18394979378";

const OUTPUT_PATH =
  process.argv[2] ?? path.resolve(process.cwd(), "data", "monday-active-buyouts.json");

const FETCH_ITEMS_QUERY = `
  query FetchBuyoutItems($boardId: [ID!]!, $cursor: String) {
    boards(ids: $boardId) {
      items_page(limit: 100, cursor: $cursor) {
        cursor
        items {
          id
          name
          column_values {
            id
            type
            text
            value
          }
        }
      }
    }
  }
`;

async function mondayQuery(query, variables, apiToken) {
  const response = await fetch(MONDAY_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: apiToken,
      "API-Version": "2024-10"
    },
    body: JSON.stringify({ query, variables })
  });

  const json = await response.json();
  if (!response.ok || json.errors) {
    throw new Error(JSON.stringify(json.errors ?? json, null, 2));
  }

  return json.data;
}

async function main() {
  const apiToken = process.env.MONDAY_API_TOKEN;
  if (!apiToken) {
    throw new Error("Missing MONDAY_API_TOKEN. Add it to .env.local or export it before running.");
  }

  const items = [];
  let cursor = null;

  do {
    const data = await mondayQuery(
      FETCH_ITEMS_QUERY,
      {
        boardId: BOARD_ID,
        cursor
      },
      apiToken
    );

    const page = data.boards?.[0]?.items_page;
    if (!page) {
      throw new Error("Monday response did not include items_page.");
    }

    items.push(...page.items);
    cursor = page.cursor;
  } while (cursor);

  await fs.mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
  await fs.writeFile(
    OUTPUT_PATH,
    JSON.stringify(
      {
        boardId: BOARD_ID,
        exportedAt: new Date().toISOString(),
        items
      },
      null,
      2
    )
  );

  console.log(`Exported ${items.length} Monday items to ${OUTPUT_PATH}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
