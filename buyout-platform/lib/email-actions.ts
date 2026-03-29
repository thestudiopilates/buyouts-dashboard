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

// Ordered list of workflow steps — earlier steps are prerequisites for later ones.
// When a template marks a step complete, all steps above it are also auto-completed.
const WORKFLOW_ORDER = [
  "inquiry-reviewed",
  "initial-inquiry-response-sent",
  "customer-responded",
  "date-finalized",
  "deposit-link-sent-and-terms-shared",
  "deposit-paid-and-terms-signed",
  "instructor-finalized",
  "momence-class-created",
  "momence-link-sign-up-sent",
  "remaining-payment-received",
  "all-attendees-registered",
  "all-waivers-signed",
  "front-desk-assigned",
  "front-desk-shift-extended",
  "final-confirmation-emails-sent",
  "event-completed"
];

function getPrerequisiteKeys(stepKeys: string[]): string[] {
  if (stepKeys.length === 0) return [];

  const maxIndex = Math.max(...stepKeys.map((k) => WORKFLOW_ORDER.indexOf(k)).filter((i) => i >= 0));
  if (maxIndex < 0) return [];

  return WORKFLOW_ORDER.slice(0, maxIndex);
}

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
  Cancelled: BuyoutStage.CANCELLED,
  DOA: BuyoutStage.DOA,
  "Not Possible": BuyoutStage.NOT_POSSIBLE,
  "On Hold": BuyoutStage.ON_HOLD
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

export async function executeTemplateReviewSend(input: {
  templateKey: string;
  buyoutId?: string;
  subjectOverride?: string;
  bodyOverride?: string;
  cc?: string;
  sendToClient?: boolean;
}) {
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

  // No strict stage gate — templates can be sent out of order.
  // Terminal buyouts still block non-universal templates.
  const terminalStages = ["Complete", "Cancelled", "DOA", "Not Possible"];
  const universalTemplates = ["t0", "t12", "t13"];
  if (terminalStages.includes(buyoutSummary.lifecycleStage) && !universalTemplates.includes(template.key)) {
    throw new Error(
      `${template.name} cannot be sent while ${buyoutSummary.name} is ${buyoutSummary.lifecycleStage}. Use Custom or Ongoing Discussion instead.`
    );
  }

  const sendPolicy = template.effectConfig.sendPolicy ?? "repeatable";
  if (sendPolicy === "single" && buyoutSummary.sentTemplateIds.includes(template.key)) {
    throw new Error(`${template.name} has already been sent for ${buyoutSummary.name}.`);
  }

  const preview = previewEmailTemplate(template, buyoutSummary);
  if (!input.bodyOverride && preview.missingVariables.length > 0) {
    throw new Error(`Missing required fields: ${preview.missingVariables.join(", ")}.`);
  }

  const finalSubject = input.subjectOverride?.trim() || preview.renderedSubject;
  const finalBody = input.bodyOverride?.trim() || preview.renderedBody;

  const workflowSeed = EMAIL_TEMPLATE_SEEDS.find((item) => item.key === input.templateKey);
  const workflowGroup = workflowGroupForCategory(workflowSeed?.category ?? template.category);
  const now = new Date();
  const gmail = getGmailReadiness();
  const deliveryMode = gmail.ready ? "gmail_test" : "simulated_test";
  const senderEmail = gmail.senderEmail ?? "simulated@thestudiopilates.local";
  const renderedHtmlDocument = renderEmailHtml({
    subject: finalSubject,
    body: finalBody,
    previewLabel: template.name
  });
  const providerResult = gmail.ready
    ? await sendGmailMessage({
        to: input.sendToClient ? buyoutSummary.clientEmail : INTERNAL_REVIEW_RECIPIENT,
        cc: input.cc || undefined,
        subject: finalSubject,
        bodyText: finalBody,
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
        subject: finalSubject,
        bodyText: finalBody,
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

    // Auto-complete prerequisite steps that logically must have happened before this template
    const explicitKeys = template.effectConfig.workflowKeys ?? [];
    const prerequisiteKeys = getPrerequisiteKeys(explicitKeys);
    for (const prereqKey of prerequisiteKeys) {
      const existing = buyoutRecord.workflowSteps.find((step) => step.stepKey === prereqKey);
      if (existing?.isComplete) continue;

      await tx.buyoutWorkflowStep.upsert({
        where: { id: existing?.id ?? `${buyoutRecord.id}_${prereqKey}` },
        update: {
          label: existing?.label ?? titleizeWorkflowKey(prereqKey),
          stepGroup: existing?.stepGroup ?? workflowGroup,
          isComplete: true,
          completedAt: now,
          completedBy: `auto-prereq:${input.templateKey}`
        },
        create: {
          id: `${buyoutRecord.id}_${prereqKey}`,
          buyoutId: buyoutRecord.id,
          stepKey: prereqKey,
          label: titleizeWorkflowKey(prereqKey),
          stepGroup: workflowGroup,
          isComplete: true,
          completedAt: now,
          completedBy: `auto-prereq:${input.templateKey}`
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
      ? input.sendToClient
        ? `Email sent to client (${buyoutSummary.clientEmail}) for ${template.name}. Workflow state updated.`
        : `Internal review send completed for ${template.name}. Sent to ${INTERNAL_REVIEW_RECIPIENT}.`
      : `Send recorded for ${template.name}. Add Gmail credentials to send from the real inbox.`,
    activity: await listEmailActivity(buyoutRecord.id),
    buyout: updatedBuyout,
    recipient: input.sendToClient ? buyoutSummary.clientEmail : INTERNAL_REVIEW_RECIPIENT,
    sentToClient: input.sendToClient ?? false
  };
}
