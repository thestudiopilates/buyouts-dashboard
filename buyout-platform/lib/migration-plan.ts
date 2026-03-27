export const mondayImportChecklist = [
  "Export all active Monday buyout items with item ids, names, and full column_values.",
  "Capture the missing status column ids for 'Where Are We Now', 'What's Due Next', and 'Ball In Court'.",
  "Capture the 16 workflow checkbox column ids so checklist state can be preserved.",
  "Freeze any board schema changes during the migration window.",
  "Run a dry-run import into a staging database.",
  "Review imported lifecycle stages, payments, dates, and assignments with the management team.",
  "Import active buyouts first, then archive/history if needed."
];

export const mondayImportOutputs = [
  "buyout inquiries",
  "active buyout records",
  "financial snapshots",
  "workflow step progress",
  "stored email template bodies",
  "legacy Monday ids for traceability"
];
