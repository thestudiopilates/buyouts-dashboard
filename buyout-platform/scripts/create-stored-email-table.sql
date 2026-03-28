-- Run this in Supabase SQL Editor to create the StoredEmail table
-- This stores Gmail email history so the dashboard reads from DB, not Gmail API

CREATE TABLE IF NOT EXISTS "StoredEmail" (
  "id" TEXT PRIMARY KEY,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "buyoutId" TEXT NOT NULL,
  "gmailMessageId" TEXT NOT NULL UNIQUE,
  "direction" TEXT NOT NULL,
  "fromAddress" TEXT NOT NULL,
  "toAddress" TEXT NOT NULL,
  "subject" TEXT,
  "snippet" TEXT,
  "bodyPreview" TEXT,
  "sentAt" TIMESTAMP(3) NOT NULL,
  "source" TEXT NOT NULL DEFAULT 'gmail-backfill'
);

CREATE INDEX IF NOT EXISTS "StoredEmail_buyoutId_idx"
ON "StoredEmail" ("buyoutId", "sentAt" DESC);

-- Also ensure BuyoutEvent and EmailTemplate tables exist
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
);

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
);

CREATE INDEX IF NOT EXISTS "BuyoutEvent_buyoutId_createdAt_idx"
ON "BuyoutEvent" ("buyoutId", "createdAt" DESC);

CREATE TABLE IF NOT EXISTS "InboxAlert" (
  "id" TEXT PRIMARY KEY,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "buyoutId" TEXT NOT NULL,
  "clientEmail" TEXT NOT NULL,
  "gmailMessageId" TEXT NOT NULL UNIQUE,
  "subject" TEXT,
  "snippet" TEXT,
  "receivedAt" TIMESTAMP(3) NOT NULL,
  "respondedAt" TIMESTAMP(3),
  "isRead" BOOLEAN NOT NULL DEFAULT FALSE,
  "isDismissed" BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS "InboxAlert_buyoutId_idx"
ON "InboxAlert" ("buyoutId", "receivedAt" DESC);

-- Verify tables exist
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('StoredEmail', 'EmailTemplate', 'BuyoutEvent', 'InboxAlert')
ORDER BY table_name;
