-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "InquiryStatus" AS ENUM ('NEW', 'REVIEWED', 'CONVERTED', 'CLOSED');

-- CreateEnum
CREATE TYPE "BuyoutStage" AS ENUM ('INQUIRY', 'RESPOND', 'DISCUSS', 'FEASIBLE', 'QUOTE', 'DEPOSIT', 'PAID', 'SIGNUPS', 'CONFIRMED', 'FINAL', 'READY', 'COMPLETE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TrackingHealth" AS ENUM ('ON_TRACK', 'AT_RISK', 'MAJOR_ISSUE', 'COMPLETE');

-- CreateEnum
CREATE TYPE "BallInCourt" AS ENUM ('TEAM', 'CLIENT', 'BOTH');

-- CreateEnum
CREATE TYPE "WorkflowGroup" AS ENUM ('INTAKE', 'PLANNING', 'PAYMENT', 'LOGISTICS', 'PRE_EVENT', 'EXECUTION');

-- CreateEnum
CREATE TYPE "EmailStatus" AS ENUM ('DRAFT', 'SENT', 'FAILED');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'DONE', 'SKIPPED');

-- CreateTable
CREATE TABLE "StaffUser" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "team" TEXT,

    CONSTRAINT "StaffUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Location" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'America/New_York',

    CONSTRAINT "Location_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BuyoutInquiry" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "legacyMondayItemId" TEXT,
    "source" TEXT NOT NULL DEFAULT 'website',
    "clientName" TEXT NOT NULL,
    "clientEmail" TEXT NOT NULL,
    "clientPhone" TEXT,
    "companyName" TEXT,
    "eventType" TEXT,
    "preferredDates" TEXT,
    "preferredLocation" TEXT,
    "guestCountEstimate" INTEGER,
    "notes" TEXT,
    "status" "InquiryStatus" NOT NULL DEFAULT 'NEW',

    CONSTRAINT "BuyoutInquiry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Buyout" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "legacyMondayItemId" TEXT,
    "displayName" TEXT NOT NULL,
    "inquiryId" TEXT,
    "lifecycleStage" "BuyoutStage" NOT NULL DEFAULT 'INQUIRY',
    "trackingHealth" "TrackingHealth" NOT NULL DEFAULT 'ON_TRACK',
    "ballInCourt" "BallInCourt" NOT NULL DEFAULT 'TEAM',
    "nextAction" TEXT,
    "notesInternal" TEXT,
    "eventDate" TIMESTAMP(3),
    "startTime" TEXT,
    "endTime" TEXT,
    "instructorName" TEXT,
    "capacity" INTEGER,
    "signupCount" INTEGER NOT NULL DEFAULT 0,
    "lastActionAt" TIMESTAMP(3),
    "assignedManagerId" TEXT,
    "locationId" TEXT,

    CONSTRAINT "Buyout_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BuyoutContact" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "buyoutId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "role" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "BuyoutContact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BuyoutFinancial" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "buyoutId" TEXT NOT NULL,
    "quotedTotal" INTEGER,
    "depositAmount" INTEGER,
    "amountPaid" INTEGER NOT NULL DEFAULT 0,
    "remainingBalance" INTEGER,
    "depositDueAt" TIMESTAMP(3),
    "finalPaymentDueAt" TIMESTAMP(3),
    "depositLink" TEXT,
    "balanceLink" TEXT,

    CONSTRAINT "BuyoutFinancial_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BuyoutWorkflowStep" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "buyoutId" TEXT NOT NULL,
    "stepKey" TEXT NOT NULL,
    "stepGroup" "WorkflowGroup" NOT NULL,
    "label" TEXT NOT NULL,
    "isComplete" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" TIMESTAMP(3),
    "completedBy" TEXT,

    CONSTRAINT "BuyoutWorkflowStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BuyoutEmail" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "buyoutId" TEXT NOT NULL,
    "templateKey" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "bodyHtml" TEXT,
    "bodyText" TEXT,
    "sentAt" TIMESTAMP(3),
    "sentBy" TEXT,
    "providerMessageId" TEXT,
    "providerThreadId" TEXT,
    "status" "EmailStatus" NOT NULL DEFAULT 'DRAFT',

    CONSTRAINT "BuyoutEmail_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BuyoutTask" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "buyoutId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "dueAt" TIMESTAMP(3),
    "ownerId" TEXT,
    "status" "TaskStatus" NOT NULL DEFAULT 'OPEN',
    "taskType" TEXT,

    CONSTRAINT "BuyoutTask_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StaffUser_email_key" ON "StaffUser"("email");

-- CreateIndex
CREATE UNIQUE INDEX "BuyoutInquiry_legacyMondayItemId_key" ON "BuyoutInquiry"("legacyMondayItemId");

-- CreateIndex
CREATE UNIQUE INDEX "Buyout_legacyMondayItemId_key" ON "Buyout"("legacyMondayItemId");

-- CreateIndex
CREATE UNIQUE INDEX "Buyout_inquiryId_key" ON "Buyout"("inquiryId");

-- CreateIndex
CREATE UNIQUE INDEX "BuyoutFinancial_buyoutId_key" ON "BuyoutFinancial"("buyoutId");

-- AddForeignKey
ALTER TABLE "Buyout" ADD CONSTRAINT "Buyout_inquiryId_fkey" FOREIGN KEY ("inquiryId") REFERENCES "BuyoutInquiry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Buyout" ADD CONSTRAINT "Buyout_assignedManagerId_fkey" FOREIGN KEY ("assignedManagerId") REFERENCES "StaffUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Buyout" ADD CONSTRAINT "Buyout_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BuyoutContact" ADD CONSTRAINT "BuyoutContact_buyoutId_fkey" FOREIGN KEY ("buyoutId") REFERENCES "Buyout"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BuyoutFinancial" ADD CONSTRAINT "BuyoutFinancial_buyoutId_fkey" FOREIGN KEY ("buyoutId") REFERENCES "Buyout"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BuyoutWorkflowStep" ADD CONSTRAINT "BuyoutWorkflowStep_buyoutId_fkey" FOREIGN KEY ("buyoutId") REFERENCES "Buyout"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BuyoutEmail" ADD CONSTRAINT "BuyoutEmail_buyoutId_fkey" FOREIGN KEY ("buyoutId") REFERENCES "Buyout"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BuyoutTask" ADD CONSTRAINT "BuyoutTask_buyoutId_fkey" FOREIGN KEY ("buyoutId") REFERENCES "Buyout"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BuyoutTask" ADD CONSTRAINT "BuyoutTask_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "StaffUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

