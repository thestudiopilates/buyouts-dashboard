import { randomUUID } from "crypto";

import { BuyoutStage, EmailStatus, Prisma, TrackingHealth, WorkflowGroup } from "@prisma/client";

import { listBuyouts } from "@/lib/buyouts";
import { renderEmailHtml } from "@/lib/email-renderer";
import {
  ensureEmailInfrastructure,
  getEmailTemplateByKey,
  listEmailActivity,
  previewEmailTemplate
} from "@/lib/email-templates";
import { getGmailReadiness, sendGmailMessage } from "@/lib/gmail";
import { EMAIL_TEMPLATE_SEEDS } from "@/lib/email-workflows";
import { hasDatabaseUrl, prisma } from "@/lib/prisma";
import type { StageKey } from "@/lib/types";

const KELLY_TEST_EMAIL = "kelly@thestudiopilates.com";
const KELLY_TEST_ITEM_ID = "10989594648";
const INTERNAL_REVIEW_RECIPIENT = process.env.EMAIL_TEST_RECIPIENT || KELLY_TEST_EMAIL;

const STAGE_ENUM_MAP: Record<StageKey, BuyoutStage> = {
  Inquiry: BuyoutStage.INQUIRY,
  Respond: BuyoutStage.RESPOND,
  Discuss: BuyoutStage.DISCUSS,
  Feasible: BuyoutStage.FEASIBLE,
  Quote: BuyoutStage.QUOTE,
  Deposit: BuyoutStage.DEPOSIT,
  Paid: BuyoutStage.PAID,
  "Sign-Ups": BuyoutStage.SIGNUPS,
  Confirmed: BuyoutStage.CONFIRMED,
  Final: BuyoutStage.FINAL,
  Ready: BuyoutStage.READY,
  Complete: BuyoutStage.COMPLETE,
  Cancelled: BuyoutStage.CANCELLED
};

const TRACKING_ENUM_MAP: Record<"On track" | "At risk" | "Major issue" | "Complete", TrackingHealth> = {
  "On track": TrackingHealth.ON_TRACK,
  "At risk": TrackingHealth.AT_RISK,
  "Major issue": TrackingHealth.MAJOR_ISSUE,
  Complete: TrackingHealth.COMPLETE
};

function titleizeWorkflowKey(key: string) {
  return key
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function workflowGroupForCategory(category: string) {
  switch (category) {
    case "Intake":
      return WorkflowGroup.INTAKE;
    case "Planning":
      return WorkflowGroup.PLANNING;
    case "Payment":
      return WorkflowGroup.PAYMENT;
    case "Logistics":
      return WorkflowGroup.LOGISTICS;
    case "Pre-Event":
      return WorkflowGroup.PRE_EVENT;
    default:
      return WorkflowGroup.EXECUTION;
  }
}

async function insertAuditEvent(
  tx: Prisma.TransactionClient,
  input: {
  buyoutId: string;
  emailId?: string;
  eventType: string;
  summary: string;
  detail: Record<string, unknown>;
  createdBy: string;
}
) {
  await tx.$executeRawUnsafe(
    `
      INSERT INTO "BuyoutEvent" (
        "id",
        "buyoutId",
        "emailId",
        "eventType",
        "summary",
        "detail",
        "createdBy"
      )
      VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7)
    `,
    randomUUID(),
    input.buyoutId,
    input.emailId ?? null,
    input.eventType,
    input.summary,
    JSON.stringify(input.detail),
    input.createdBy
  );
}

async function resolveBuyoutRecord(buyoutId?: string) {
  if (buyoutId) {
    return prisma.buyout.findUnique({
      where: { id: buyoutId },
      include: {
        workflowSteps: true
      }
    });
  }

  return (
    (await prisma.buyout.findFirst({
      where: {
        legacyMondayItemId: KELLY_TEST_ITEM_ID
      },
      include: {
        workflowSteps: true
      }
    })) ??
    (await prisma.buyout.findFirst({
      where: {
        displayName: "Kelly Jackson Test Event"
      },
      include: {
        workflowSteps: true
      }
    })) ??
    (await prisma.buyout.findFirst({
      where: {
        inquiry: { clientEmail: KELLY_TEST_EMAIL }
      },
      include: {
        workflowSteps: true
      }
    }))
  );
}

export async function executeTemplateReviewSend(input: { templateKey: string; buyoutId?: string }) {
  if (!hasDatabaseUrl()) {
    throw new Error("Database connection is required for test sends.");
  }

  await ensureEmailInfrastructure();

  const template = await getEmailTemplateByKey(input.templateKey);
  if (!template) {
    throw new Error(`Unknown email template: ${input.templateKey}`);
  }

  const buyoutRecord = await resolveBuyoutRecord(input.buyoutId);

  if (!buyoutRecord) {
    throw new Error("The selected buyout could not be found.");
  }

  const buyoutSummary = (await listBuyouts()).find((item) => item.id === buyoutRecord.id) ?? null;
  if (!buyoutSummary) {
    throw new Error("The selected buyout summary is unavailable.");
  }

  if (!template.allowedStages.includes(buyoutSummary.lifecycleStage)) {
    throw new Error(
      `${template.name} is blocked while ${buyoutSummary.name} is in ${buyoutSummary.lifecycleStage}.`
    );
  }

  const sendPolicy = template.effectConfig.sendPolicy ?? "repeatable";
  if (sendPolicy === "single" && buyoutSummary.sentTemplateIds.includes(template.key)) {
    throw new Error(`${template.name} has already been sent for ${buyoutSummary.name}.`);
  }

  const preview = previewEmailTemplate(template, buyoutSummary);
  if (preview.missingVariables.length > 0) {
    throw new Error(`Missing required fields: ${preview.missingVariables.join(", ")}.`);
  }

  const workflowSeed = EMAIL_TEMPLATE_SEEDS.find((item) => item.key === input.templateKey);
  const workflowGroup = workflowGroupForCategory(workflowSeed?.category ?? template.category);
  const now = new Date();
  const gmail = getGmailReadiness();
  const deliveryMode = gmail.ready ? "gmail_test" : "simulated_test";
  const senderEmail = gmail.senderEmail ?? "simulated@thestudiopilates.local";
  const renderedHtmlDocument = renderEmailHtml({
    subject: preview.renderedSubject,
    body: preview.renderedBody,
    previewLabel: template.name
  });
  const providerResult = gmail.ready
    ? await sendGmailMessage({
        to: INTERNAL_REVIEW_RECIPIENT,
        subject: preview.renderedSubject,
        bodyText: preview.renderedBody,
        bodyHtml: renderedHtmlDocument
      })
    : {
        messageId: `test_${randomUUID()}`,
        threadId: `test_thread_${buyoutRecord.id}`
      };

  await prisma.$transaction(async (tx) => {
    const email = await tx.buyoutEmail.create({
      data: {
        buyoutId: buyoutRecord.id,
        templateKey: input.templateKey,
        subject: preview.renderedSubject,
        bodyText: preview.renderedBody,
        bodyHtml: renderedHtmlDocument,
        status: EmailStatus.SENT,
        sentAt: now,
        sentBy: senderEmail,
        providerMessageId: providerResult.messageId,
        providerThreadId: providerResult.threadId
      }
    });

    const updateData: {
      lifecycleStage?: BuyoutStage;
      trackingHealth?: TrackingHealth;
      nextAction?: string;
      lastActionAt: Date;
    } = {
      lastActionAt: now
    };

    if (template.effectConfig.stageChange) {
      updateData.lifecycleStage = STAGE_ENUM_MAP[template.effectConfig.stageChange];
    }

    if (template.effectConfig.trackingHealth) {
      updateData.trackingHealth = TRACKING_ENUM_MAP[template.effectConfig.trackingHealth];
    }

    if (template.effectConfig.nextAction) {
      updateData.nextAction = template.effectConfig.nextAction;
    }

    await tx.buyout.update({
      where: { id: buyoutRecord.id },
      data: updateData
    });

    for (const workflowKey of template.effectConfig.workflowKeys ?? []) {
      const existing = buyoutRecord.workflowSteps.find((step) => step.stepKey === workflowKey);
      await tx.buyoutWorkflowStep.upsert({
        where: {
          id: existing?.id ?? `${buyoutRecord.id}_${workflowKey}`
        },
        update: {
          label: existing?.label ?? titleizeWorkflowKey(workflowKey),
          stepGroup: existing?.stepGroup ?? workflowGroup,
          isComplete: true,
          completedAt: now,
          completedBy: senderEmail
        },
        create: {
          id: `${buyoutRecord.id}_${workflowKey}`,
          buyoutId: buyoutRecord.id,
          stepKey: workflowKey,
          label: existing?.label ?? titleizeWorkflowKey(workflowKey),
          stepGroup: existing?.stepGroup ?? workflowGroup,
          isComplete: true,
          completedAt: now,
          completedBy: senderEmail
        }
      });
    }

    await insertAuditEvent(tx, {
      buyoutId: buyoutRecord.id,
      emailId: email.id,
      eventType: "EMAIL_TEST_SENT",
      summary: `Internal review send recorded for ${template.name}`,
      detail: {
        mode: deliveryMode,
        recipient: INTERNAL_REVIEW_RECIPIENT,
        senderEmail,
        templateKey: input.templateKey,
        sendPolicy,
        stageBefore: buyoutSummary.lifecycleStage,
        stageAfter: template.effectConfig.stageChange ?? buyoutSummary.lifecycleStage,
        nextAction: template.effectConfig.nextAction ?? buyoutSummary.nextAction,
        workflowKeys: template.effectConfig.workflowKeys ?? []
      },
      createdBy: senderEmail
    });
  });

  const updatedBuyout = (await listBuyouts()).find((item) => item.id === buyoutRecord.id) ?? null;

  return {
    message: gmail.ready
      ? `Internal Gmail review send completed for ${template.name}. Sent to ${INTERNAL_REVIEW_RECIPIENT} and workflow state updated from the template rules.`
      : `Internal review send recorded for ${template.name}. Add Gmail credentials to send from the real inbox.`,
    activity: await listEmailActivity(buyoutRecord.id),
    buyout: updatedBuyout,
    recipient: INTERNAL_REVIEW_RECIPIENT
  };
}
