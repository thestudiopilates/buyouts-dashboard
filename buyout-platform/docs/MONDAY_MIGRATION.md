# Monday Migration Plan

## Goal

Pull existing buyout records out of Monday and load them into the new buyout platform so the new app can become the operational system of record.

## Migration Approach

Migrate in two layers:

1. Active buyout records first
2. Historical and optional reference data second

This keeps the first cutover focused on what the team actually needs day to day.

## What We Can Already Map

The current repository gives us a reliable mapping for:

- client name
- client email
- CC emails
- preferred and finalized dates
- start and end time
- preferred and final location
- instructor
- total price
- amount paid
- deposit amount
- remaining balance
- deposit link
- balance link
- signup link
- tracking health
- email thread ids
- email template bodies

Those mappings are scaffolded in [monday-mapping.ts](/Users/kellyjackson/Documents/Codex/Buyouts%20Dashboard/buyout-platform/lib/monday-mapping.ts).

## What Is Still Missing From Monday

The current docs do not include the actual Monday column ids for:

- `Where Are We Now`
- `What's Due Next`
- `Ball In Court`
- the 16 workflow checkbox columns

These need to be exported from Monday before we can perform a complete fidelity import.

## Recommended Export Format

Export or query the Monday board into a JSON payload shaped like:

```json
{
  "items": [
    {
      "id": "123456",
      "name": "Sarah Chen",
      "column_values": [
        { "id": "emailoeuk5uwf", "text": "sarah@example.com" }
      ]
    }
  ]
}
```

That is the shape expected by the migration mapper types in [monday-types.ts](/Users/kellyjackson/Documents/Codex/Buyouts%20Dashboard/buyout-platform/lib/monday-types.ts).

## Fastest Path To Real Import

If you want the fastest practical cutover:

1. Export only active buyouts first.
2. Include item `id`, `name`, and full `column_values`.
3. Save the export as `buyout-platform/data/monday-active-buyouts.json`.
4. Run:

```bash
cd buyout-platform
export PATH="$HOME/.local/bin:$PATH"
npm run import:monday -- ./data/monday-active-buyouts.json
```

The importer currently handles:

- core buyout details
- financials
- linked imported inquiry records
- default workflow derivation from lifecycle stage

It does not yet preserve exact workflow checkbox completion unless the missing workflow column ids are included in a later export.

## Migration Sequence

1. Export Monday board data for all active buyouts.
2. Confirm missing status and workflow column ids.
3. Run a dry import into staging.
4. Compare several records manually against Monday.
5. Import active records into production.
6. Keep legacy Monday item ids in the new database for traceability.
7. Freeze Monday to reference-only mode once the team is live in the new app.

## Data Preservation Rules

- Preserve legacy Monday item id on imported inquiries and buyouts
- Import financial amounts exactly as they appear at cutover
- Preserve email template text for reference where useful
- Do not import `t13` as a clean reusable template without review

## Implementation Notes

The Prisma schema now includes:

- `Buyout.legacyMondayItemId`
- `BuyoutInquiry.legacyMondayItemId`

That lets us trace every migrated record back to Monday during reconciliation.

## Next Practical Step

The real import command now exists at [import-monday.mjs](/Users/kellyjackson/Documents/Codex/Buyouts%20Dashboard/buyout-platform/scripts/import-monday.mjs).

The next blocker is the actual Monday JSON export file.
