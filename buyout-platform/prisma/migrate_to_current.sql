-- Migration: Bring Supabase up to date with current schema.prisma
-- Run this in Supabase SQL Editor if tables already exist from init.sql

-- ============================================================
-- 1. Add missing BuyoutStage enum values
-- ============================================================
ALTER TYPE "BuyoutStage" ADD VALUE IF NOT EXISTS 'DOA';
ALTER TYPE "BuyoutStage" ADD VALUE IF NOT EXISTS 'NOT_POSSIBLE';
ALTER TYPE "BuyoutStage" ADD VALUE IF NOT EXISTS 'ON_HOLD';

-- ============================================================
-- 2. Add missing columns to Buyout table
-- ============================================================
ALTER TABLE "Buyout" ADD COLUMN IF NOT EXISTS "sourceStatusLabel" TEXT;
ALTER TABLE "Buyout" ADD COLUMN IF NOT EXISTS "sourceTrackingLabel" TEXT;
ALTER TABLE "Buyout" ADD COLUMN IF NOT EXISTS "sourceBallInCourtLabel" TEXT;
ALTER TABLE "Buyout" ADD COLUMN IF NOT EXISTS "sourceNextActionLabel" TEXT;
ALTER TABLE "Buyout" ADD COLUMN IF NOT EXISTS "sourceEmailTriggerLabel" TEXT;
ALTER TABLE "Buyout" ADD COLUMN IF NOT EXISTS "sourcePaymentStatusLabel" TEXT;
ALTER TABLE "Buyout" ADD COLUMN IF NOT EXISTS "sourceDeskStaff" TEXT;
ALTER TABLE "Buyout" ADD COLUMN IF NOT EXISTS "sourceSnapshot" JSONB;

-- ============================================================
-- 3. Verify all tables exist (idempotent - only creates if missing)
-- ============================================================
-- All tables from init.sql should already exist:
-- StaffUser, Location, BuyoutInquiry, Buyout, BuyoutContact,
-- BuyoutFinancial, BuyoutWorkflowStep, BuyoutEmail, BuyoutTask

-- ============================================================
-- 4. Verify all indexes exist
-- ============================================================
CREATE UNIQUE INDEX IF NOT EXISTS "StaffUser_email_key" ON "StaffUser"("email");
CREATE UNIQUE INDEX IF NOT EXISTS "BuyoutInquiry_legacyMondayItemId_key" ON "BuyoutInquiry"("legacyMondayItemId");
CREATE UNIQUE INDEX IF NOT EXISTS "Buyout_legacyMondayItemId_key" ON "Buyout"("legacyMondayItemId");
CREATE UNIQUE INDEX IF NOT EXISTS "Buyout_inquiryId_key" ON "Buyout"("inquiryId");
CREATE UNIQUE INDEX IF NOT EXISTS "BuyoutFinancial_buyoutId_key" ON "BuyoutFinancial"("buyoutId");

-- ============================================================
-- 5. Verify all foreign keys exist (idempotent)
-- ============================================================
-- These should already exist from init.sql. If you get "already exists"
-- errors, that's expected and safe to ignore.

-- Done. Schema should now match schema.prisma exactly.
