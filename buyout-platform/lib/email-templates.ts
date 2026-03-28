import { randomUUID } from "crypto";
import fs from "fs/promises";
import path from "path";

import { listBuyouts } from "@/lib/buyouts";
import { renderEmailHtml } from "@/lib/email-renderer";
import { getGmailReadiness, type GmailReadiness } from "@/lib/gmail";
import { EMAIL_TEMPLATE_SEEDS, EmailEffectDefinition, EmailVariableDefinition } from "@/lib/email-workflows";
import { hasDatabaseUrl, prisma } from "@/lib/prisma";
import { BuyoutSummary } from "@/lib/types";

export type EmailTemplateRecord = {
  id: string;
  key: string;
  name: string;
  triggerLabel: string;
  category: string;
  subjectTemplate: string;
  bodyTemplate: string;
  requiredVariables: EmailVariableDefinition[];
  allowedStages: string[];
  effectConfig: EmailEffectDefinition;
  isActive: boolean;
};

export type EmailTemplatePreview = {
  key: string;
  variables: Record<string, string>;
  missingVariables: string[];
  renderedSubject: string;
  renderedBody: string;
  renderedHtml: string;
};

export type EmailActivityRecord = {
  id: string;
  createdAt: string;
  eventType: string;
  summary: string;
  templateKey?: string;
  mode?: string;
  stageBefore?: string;
  stageAfter?: string;
  nextAction?: string;
  workflowKeys: string[];
};

type TemplateRow = {
  id: string;
  key: string;
  name: string;
  triggerLabel: string;
  category: string;
  subjectTemplate: string;
  bodyTemplate: string;
  requiredVariables: unknown;
  allowedStages: unknown;
  effectConfig: unknown;
  isActive: boolean;
};

type EventRow = {
  id: string;
  createdAt: Date | string;
  eventType: string;
  summary: string;
  detail: unknown;
};

const KELLY_TEST_EMAIL = "kelly@thestudiopilates.com";
const KELLY_TEST_ITEM_ID = "10989594648";
const TEMPLATE_SOURCE_DIR = path.join(process.cwd(), "template-source");
const TEMPLATE_SOURCE_MANIFEST_PATH = path.join(process.cwd(), "template-source", "manifest.json");
const TEMPLATE_SOURCE_HTML_DIR = path.join(TEMPLATE_SOURCE_DIR, "html");
const TEMPLATE_SOURCE_TEXT_DIR = path.join(TEMPLATE_SOURCE_DIR, "text");

type SourceTemplateRecord = {
  key: string;
  name: string;
  subjectTemplate: string;
  bodyTemplate: string;
};

function asObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

async function getSourceControlledTemplates() {
  try {
    const manifest = await fs.readFile(TEMPLATE_SOURCE_MANIFEST_PATH, "utf8");
    const parsed = JSON.parse(manifest);

    if (!Array.isArray(parsed)) {
      return [] as SourceTemplateRecord[];
    }

    return parsed
      .map((item) => {
        const row = asObject(item);
        if (!row) {
          return null;
        }

        return {
          key: typeof row.key === "string" ? row.key : "",
          name: typeof row.name === "string" ? row.name : "",
          subjectTemplate: typeof row.subjectTemplate === "string" ? row.subjectTemplate : "",
          bodyTemplate: typeof row.bodyTemplate === "string" ? row.bodyTemplate : ""
        };
      })
      .filter(
        (item): item is SourceTemplateRecord =>
          Boolean(item?.key && item.name && item.subjectTemplate && item.bodyTemplate)
      );
  } catch {
    return [] as SourceTemplateRecord[];
  }
}

async function writeSourceControlledTemplates(templates: SourceTemplateRecord[]) {
  try {
    await fs.mkdir(TEMPLATE_SOURCE_HTML_DIR, { recursive: true });
    await fs.mkdir(TEMPLATE_SOURCE_TEXT_DIR, { recursive: true });

    const normalizedTemplates = [...templates].sort((left, right) => left.key.localeCompare(right.key));

    await fs.writeFile(TEMPLATE_SOURCE_MANIFEST_PATH, `${JSON.stringify(normalizedTemplates, null, 2)}\n`);

    await Promise.all(
      normalizedTemplates.map(async (template) => {
        await fs.writeFile(
          path.join(TEMPLATE_SOURCE_TEXT_DIR, `${template.key}.txt`),
          `${template.subjectTemplate}\n\n${template.bodyTemplate}\n`
        );

        await fs.writeFile(
          path.join(TEMPLATE_SOURCE_HTML_DIR, `${template.key}.html`),
          renderEmailHtml({
            subject: template.subjectTemplate,
            body: template.bodyTemplate,
            previewLabel: template.name
          })
        );
      })
    );
  } catch {
    // Filesystem writes are best-effort — they fail on read-only deployments
  }
}

function buildSourceTemplateRecord(
  seed: (typeof EMAIL_TEMPLATE_SEEDS)[number],
  input?: Partial<Pick<SourceTemplateRecord, "subjectTemplate" | "bodyTemplate">>
) {
  return {
    key: seed.key,
    name: seed.name,
    subjectTemplate: input?.subjectTemplate ?? seed.subjectTemplate,
    bodyTemplate: input?.bodyTemplate ?? seed.fallbackBodyTemplate
  };
}

async function getCanonicalSourceTemplates() {
  const sourceTemplates = await getSourceControlledTemplates();

  return EMAIL_TEMPLATE_SEEDS.map((seed) => {
    const existing = sourceTemplates.find((item) => item.key === seed.key);
    return buildSourceTemplateRecord(seed, existing);
  });
}

function parseJsonArray<T>(value: unknown): T[] {
  if (Array.isArray(value)) {
    return value as T[];
  }

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? (parsed as T[]) : [];
    } catch {
      return [];
    }
  }

  return [];
}

function parseJsonObject<T extends object>(value: unknown, fallback: T): T {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as T;
  }

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as T;
      }
    } catch {
      return fallback;
    }
  }

  return fallback;
}

function formatCurrency(value: number | undefined) {
  if (!value || value <= 0) {
    return "";
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0
  }).format(value);
}

function normalizeTemplateField(value: string | null | undefined) {
  if (!value) {
    return "";
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }

  if (["tbd", "unassigned", "buyout"].includes(trimmed.toLowerCase())) {
    return "";
  }

  return trimmed;
}

function deriveHoursLabel(buyout: BuyoutSummary) {
  if (buyout.numberOfHours && buyout.numberOfHours > 0) {
    const hours = buyout.numberOfHours;
    if (Number.isFinite(hours) && hours > 0) {
      return Number.isInteger(hours) ? `${hours}` : hours.toFixed(1);
    }
  }

  return "";
}

function renderTemplateValue(input: string, variables: Record<string, string>) {
  const rendered = input.replace(/\{\{([^}]+)\}\}/g, (original, token) => {
    const normalizedToken = token
      .trim()
      .replace(/[^\w\s]/g, "")
      .replace(/\s+/g, " ")
      .toLowerCase();

    const match = Object.entries(variables).find(([variableKey]) => {
      const normalizedKey = variableKey
        .replace(/([A-Z])/g, " $1")
        .trim()
        .toLowerCase();
      return normalizedKey === normalizedToken;
    });

    if (!match) {
      return original;
    }

    return match[1];
  });

  return rendered
    .split("\n")
    .filter((line) => !line.includes("{{"))
    .filter((line) => !/^<b>[^<]+<\/b>[:.]?\s*$/i.test(line.trim()))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n");
}

function getLegacyTemplateBody(snapshot: unknown, legacyColumnId: string) {
  const snapshotObject = asObject(snapshot);
  if (!snapshotObject) {
    return undefined;
  }

  const columnValues = asObject(snapshotObject.columnValues);
  const directValue = columnValues ? asObject(columnValues[legacyColumnId]) : null;
  if (directValue && typeof directValue.text === "string" && directValue.text.trim()) {
    return directValue.text.trim();
  }

  const columnValueList = Array.isArray(snapshotObject.column_values) ? snapshotObject.column_values : [];
  const fromList = columnValueList.find((item) => {
    const row = asObject(item);
    return row?.id === legacyColumnId;
  });
  const fromListObject = asObject(fromList);
  if (fromListObject && typeof fromListObject.text === "string" && fromListObject.text.trim()) {
    return fromListObject.text.trim();
  }

  const valueBag = asObject(snapshotObject.values);
  const rawValue = valueBag?.[legacyColumnId];
  if (typeof rawValue === "string" && rawValue.trim()) {
    return rawValue.trim();
  }

  return undefined;
}

function toTemplateRecord(row: TemplateRow): EmailTemplateRecord {
  return {
    id: row.id,
    key: row.key,
    name: row.name,
    triggerLabel: row.triggerLabel,
    category: row.category,
    subjectTemplate: row.subjectTemplate,
    bodyTemplate: row.bodyTemplate,
    requiredVariables: parseJsonArray<EmailVariableDefinition>(row.requiredVariables),
    allowedStages: parseJsonArray<string>(row.allowedStages),
    effectConfig: parseJsonObject<EmailEffectDefinition>(row.effectConfig, {}),
    isActive: row.isActive
  };
}

export async function ensureEmailInfrastructure() {
  if (!hasDatabaseUrl()) {
    return;
  }

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "EmailTemplate" (
      "id" TEXT PRIMARY KEY,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "key" TEXT NOT NULL UNIQUE,
      "name" TEXT NOT NULL,
      "triggerLabel" TEXT NOT NULL,
      "category" TEXT NOT NULL,
      "subjectTemplate" TEXT NOT NULL,
      "bodyTemplate" TEXT NOT NULL,
      "requiredVariables" JSONB NOT NULL DEFAULT '[]'::jsonb,
      "allowedStages" JSONB NOT NULL DEFAULT '[]'::jsonb,
      "effectConfig" JSONB NOT NULL DEFAULT '{}'::jsonb,
      "isActive" BOOLEAN NOT NULL DEFAULT TRUE
    )
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "BuyoutEvent" (
      "id" TEXT PRIMARY KEY,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "buyoutId" TEXT NOT NULL,
      "emailId" TEXT,
      "eventType" TEXT NOT NULL,
      "summary" TEXT NOT NULL,
      "detail" JSONB,
      "createdBy" TEXT
    )
  `);

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "BuyoutEvent_buyoutId_createdAt_idx"
    ON "BuyoutEvent" ("buyoutId", "createdAt" DESC)
  `);
}

async function getKellySourceSnapshot() {
  const buyout = await prisma.buyout.findFirst({
    where: {
      OR: [{ legacyMondayItemId: KELLY_TEST_ITEM_ID }, { displayName: "Kelly Jackson Test Event" }]
    },
    select: {
      sourceSnapshot: true
    }
  });

  return buyout?.sourceSnapshot ?? null;
}

async function seedTemplatesIfNeeded() {
  if (!hasDatabaseUrl()) {
    return;
  }

  await ensureEmailInfrastructure();

  const rows = (await prisma.$queryRawUnsafe(`
    SELECT COUNT(*)::int AS "count"
    FROM "EmailTemplate"
  `)) as Array<{ count: number }>;

  if ((rows[0]?.count ?? 0) > 0) {
    return;
  }

  const sourceSnapshot = await getKellySourceSnapshot();
  const sourceTemplates = await getCanonicalSourceTemplates();

  for (const seed of EMAIL_TEMPLATE_SEEDS) {
    const sourceTemplate = sourceTemplates.find((item) => item.key === seed.key);
    const subjectTemplate = sourceTemplate?.subjectTemplate ?? seed.subjectTemplate;
    const bodyTemplate =
      sourceTemplate?.bodyTemplate ??
      getLegacyTemplateBody(sourceSnapshot, seed.legacyColumnId) ??
      seed.fallbackBodyTemplate;

    await prisma.$executeRawUnsafe(
      `
        INSERT INTO "EmailTemplate" (
          "id",
          "key",
          "name",
          "triggerLabel",
          "category",
          "subjectTemplate",
          "bodyTemplate",
          "requiredVariables",
          "allowedStages",
          "effectConfig",
          "isActive"
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9::jsonb, $10::jsonb, $11)
      `,
      randomUUID(),
      seed.key,
      seed.name,
      seed.triggerLabel,
      seed.category,
      subjectTemplate,
      bodyTemplate,
      JSON.stringify(seed.requiredVariables),
      JSON.stringify(seed.allowedStages),
      JSON.stringify(seed.effectConfig),
      true
    );
  }
}

async function syncDatabaseTemplatesFromSource() {
  if (!hasDatabaseUrl()) {
    return;
  }

  await ensureEmailInfrastructure();

  const sourceTemplates = await getCanonicalSourceTemplates();

  for (const seed of EMAIL_TEMPLATE_SEEDS) {
    const sourceTemplate = sourceTemplates.find((item) => item.key === seed.key) ?? buildSourceTemplateRecord(seed);

    await prisma.$executeRawUnsafe(
      `
        INSERT INTO "EmailTemplate" (
          "id",
          "key",
          "name",
          "triggerLabel",
          "category",
          "subjectTemplate",
          "bodyTemplate",
          "requiredVariables",
          "allowedStages",
          "effectConfig",
          "isActive"
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9::jsonb, $10::jsonb, $11)
        ON CONFLICT ("key")
        DO UPDATE SET
          "name" = EXCLUDED."name",
          "triggerLabel" = EXCLUDED."triggerLabel",
          "category" = EXCLUDED."category",
          "subjectTemplate" = EXCLUDED."subjectTemplate",
          "bodyTemplate" = EXCLUDED."bodyTemplate",
          "requiredVariables" = EXCLUDED."requiredVariables",
          "allowedStages" = EXCLUDED."allowedStages",
          "effectConfig" = EXCLUDED."effectConfig",
          "isActive" = EXCLUDED."isActive",
          "updatedAt" = CURRENT_TIMESTAMP
      `,
      randomUUID(),
      seed.key,
      seed.name,
      seed.triggerLabel,
      seed.category,
      sourceTemplate.subjectTemplate,
      sourceTemplate.bodyTemplate,
      JSON.stringify(seed.requiredVariables),
      JSON.stringify(seed.allowedStages),
      JSON.stringify(seed.effectConfig),
      true
    );
  }
}

async function buildFallbackTemplates() {
  const sourceTemplates = await getCanonicalSourceTemplates();

  return EMAIL_TEMPLATE_SEEDS.map((seed) => {
    const sourceTemplate = sourceTemplates.find((item) => item.key === seed.key);

    return {
      id: seed.key,
      key: seed.key,
      name: seed.name,
      triggerLabel: seed.triggerLabel,
      category: seed.category,
      subjectTemplate: sourceTemplate?.subjectTemplate ?? seed.subjectTemplate,
      bodyTemplate: sourceTemplate?.bodyTemplate ?? seed.fallbackBodyTemplate,
      requiredVariables: seed.requiredVariables,
      allowedStages: seed.allowedStages,
      effectConfig: seed.effectConfig,
      isActive: true
    };
  });
}

function buildEmailVariables(buyout: BuyoutSummary | null): Record<string, string> {
  if (!buyout) {
    return {
      clientName: "",
      clientFirstName: "",
      preferredDate: "",
      preferredLocation: "",
      eventDate: "",
      startTime: "",
      endTime: "",
      location: "",
      instructor: "",
      numberOfHours: "",
      totalPrice: "",
      amountPaid: "",
      depositAmount: "",
      depositLink: "",
      remainingBalance: "",
      remainingBalanceLink: "",
      signupLink: "",
      clientEmail: ""
    };
  }

  const clientName = normalizeTemplateField(buyout.clientName) || buyout.name.replace(/\s+Test Event$/i, "").trim() || buyout.name;
  const clientFirstName = clientName.split(/\s+/)[0] ?? clientName;
  const eventDate = normalizeTemplateField(buyout.eventDate);
  const totalPrice = formatCurrency(buyout.total);
  const amountPaid = formatCurrency(buyout.amountPaid);
  const remainingBalance = formatCurrency(buyout.outstanding);
  const depositAmount = formatCurrency(buyout.depositAmount ?? (buyout.total && buyout.amountPaid ? Math.min(buyout.total, buyout.amountPaid) : 0));

  return {
    clientName,
    clientFirstName,
    preferredDate: normalizeTemplateField(buyout.preferredDates) || eventDate,
    preferredLocation: normalizeTemplateField(buyout.preferredLocation) || normalizeTemplateField(buyout.location),
    eventDate,
    startTime: normalizeTemplateField(buyout.startTime),
    endTime: normalizeTemplateField(buyout.endTime),
    location: normalizeTemplateField(buyout.location),
    instructor: normalizeTemplateField(buyout.instructor),
    numberOfHours: deriveHoursLabel(buyout),
    totalPrice,
    amountPaid,
    depositAmount,
    depositLink: normalizeTemplateField(buyout.depositLink),
    remainingBalance,
    remainingBalanceLink: normalizeTemplateField(buyout.balanceLink),
    signupLink: normalizeTemplateField(buyout.signupLink),
    clientEmail: normalizeTemplateField(buyout.clientEmail) || KELLY_TEST_EMAIL
  };
}

export function previewEmailTemplate(template: EmailTemplateRecord, buyout: BuyoutSummary | null): EmailTemplatePreview {
  const variables = buildEmailVariables(buyout);
  const renderedSubject = renderTemplateValue(template.subjectTemplate, variables);
  const renderedBody = renderTemplateValue(template.bodyTemplate, variables);
  const missingVariables = template.requiredVariables
    .filter((item) => !variables[item.key as keyof typeof variables])
    .map((item) => item.label);

  return {
    key: template.key,
    variables,
    missingVariables,
    renderedSubject,
    renderedBody,
    renderedHtml: renderEmailHtml({
      subject: renderedSubject,
      body: renderedBody,
      previewLabel: template.name
    })
  };
}

function toIsoTimestamp(value: Date | string) {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function toActivityRecord(row: EventRow): EmailActivityRecord {
  const detail = parseJsonObject<Record<string, unknown>>(row.detail, {});

  return {
    id: row.id,
    createdAt: toIsoTimestamp(row.createdAt),
    eventType: row.eventType,
    summary: row.summary,
    templateKey: typeof detail.templateKey === "string" ? detail.templateKey : undefined,
    mode: typeof detail.mode === "string" ? detail.mode : undefined,
    stageBefore: typeof detail.stageBefore === "string" ? detail.stageBefore : undefined,
    stageAfter: typeof detail.stageAfter === "string" ? detail.stageAfter : undefined,
    nextAction: typeof detail.nextAction === "string" ? detail.nextAction : undefined,
    workflowKeys: Array.isArray(detail.workflowKeys)
      ? detail.workflowKeys.filter((item): item is string => typeof item === "string")
      : []
  };
}

export async function listEmailTemplates(): Promise<EmailTemplateRecord[]> {
  if (!hasDatabaseUrl()) {
    const fallbackTemplates = await buildFallbackTemplates();
    await writeSourceControlledTemplates(
      fallbackTemplates.map((template) => ({
        key: template.key,
        name: template.name,
        subjectTemplate: template.subjectTemplate,
        bodyTemplate: template.bodyTemplate
      }))
    );
    return fallbackTemplates;
  }

  await seedTemplatesIfNeeded();
  await writeSourceControlledTemplates(await getCanonicalSourceTemplates());
  await syncDatabaseTemplatesFromSource();

  const rows = (await prisma.$queryRawUnsafe(`
    SELECT
      "id",
      "key",
      "name",
      "triggerLabel",
      "category",
      "subjectTemplate",
      "bodyTemplate",
      "requiredVariables",
      "allowedStages",
      "effectConfig",
      "isActive"
    FROM "EmailTemplate"
    ORDER BY "key" ASC
  `)) as TemplateRow[];

  return rows.map(toTemplateRecord);
}

export async function getEmailTemplateByKey(key: string): Promise<EmailTemplateRecord | null> {
  const templates = await listEmailTemplates();
  return templates.find((template) => template.key === key) ?? null;
}

export async function updateEmailTemplate(
  key: string,
  input: { subjectTemplate: string; bodyTemplate: string }
): Promise<EmailTemplateRecord> {
  const seed = EMAIL_TEMPLATE_SEEDS.find((item) => item.key === key);
  if (!seed) {
    throw new Error(`Unknown email template: ${key}`);
  }

  const currentSourceTemplates = await getCanonicalSourceTemplates();
  const nextSourceTemplates = currentSourceTemplates.map((template) =>
    template.key === key
      ? {
          ...template,
          subjectTemplate: input.subjectTemplate,
          bodyTemplate: input.bodyTemplate
        }
      : template
  );

  await writeSourceControlledTemplates(nextSourceTemplates);

  if (!hasDatabaseUrl()) {
    const template = (await buildFallbackTemplates()).find((item) => item.key === key);
    if (!template) {
      throw new Error(`Unknown email template: ${key}`);
    }

    return {
      ...template,
      subjectTemplate: input.subjectTemplate,
      bodyTemplate: input.bodyTemplate
    };
  }

  await seedTemplatesIfNeeded();
  await syncDatabaseTemplatesFromSource();

  const rows = (await prisma.$queryRawUnsafe(
    `
      SELECT
        "id",
        "key",
        "name",
        "triggerLabel",
        "category",
        "subjectTemplate",
        "bodyTemplate",
        "requiredVariables",
        "allowedStages",
        "effectConfig",
        "isActive"
      FROM "EmailTemplate"
      WHERE "key" = $1
      LIMIT 1
    `,
    key
  )) as TemplateRow[];

  const row = rows[0];
  if (!row) {
    throw new Error(`Unknown email template: ${key}`);
  }

  return toTemplateRecord(row);
}

export async function listEmailActivity(buyoutId?: string | null): Promise<EmailActivityRecord[]> {
  if (!hasDatabaseUrl() || !buyoutId) {
    return [];
  }

  await ensureEmailInfrastructure();

  const rows = (await prisma.$queryRawUnsafe(
    `
      SELECT
        "id",
        "createdAt",
        "eventType",
        "summary",
        "detail"
      FROM "BuyoutEvent"
      WHERE "buyoutId" = $1
      ORDER BY "createdAt" DESC
      LIMIT 100
    `,
    buyoutId
  )) as EventRow[];

  return rows.map(toActivityRecord);
}

export async function getEmailWorkspaceData() {
  const [templates, buyouts] = await Promise.all([listEmailTemplates(), listBuyouts()]);
  const buyout =
    buyouts.find((item) => item.clientEmail.toLowerCase() === KELLY_TEST_EMAIL) ??
    buyouts.find((item) => item.name === "Kelly Jackson Test Event") ??
    buyouts[0] ??
    null;
  const previews = templates.map((template) => previewEmailTemplate(template, buyout));
  const activity = await listEmailActivity(buyout?.id);
  const gmail = getGmailReadiness();

  return {
    templates,
    buyout,
    previews,
    activity,
    gmail
  };
}

export async function getBuyoutEmailPanelData(buyoutId: string) {
  const [templates, buyouts] = await Promise.all([listEmailTemplates(), listBuyouts()]);
  const buyout = buyouts.find((item) => item.id === buyoutId) ?? null;
  const previews = templates.map((template) => previewEmailTemplate(template, buyout));
  const activity = await listEmailActivity(buyout?.id);
  const gmail = getGmailReadiness();

  return {
    templates,
    buyout,
    previews,
    activity,
    gmail
  };
}
