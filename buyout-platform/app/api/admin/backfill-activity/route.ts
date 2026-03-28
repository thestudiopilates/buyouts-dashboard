import { randomUUID } from "crypto";

import { NextResponse } from "next/server";

import { ensureEmailInfrastructure } from "@/lib/email-templates";
import { hasDatabaseUrl, prisma } from "@/lib/prisma";

export async function POST() {
  if (!hasDatabaseUrl()) {
    return NextResponse.json({ error: "Database required." }, { status: 400 });
  }

  await ensureEmailInfrastructure();

  const buyouts = await prisma.buyout.findMany({
    include: {
      inquiry: true,
      emails: { orderBy: { sentAt: "asc" } },
      workflowSteps: { orderBy: { createdAt: "asc" } }
    }
  });

  let created = 0;

  for (const buyout of buyouts) {
    const existingEvents = await prisma.$queryRawUnsafe(
      `SELECT COUNT(*)::int AS "count" FROM "BuyoutEvent" WHERE "buyoutId" = $1`,
      buyout.id
    ) as Array<{ count: number }>;

    if ((existingEvents[0]?.count ?? 0) > 0) continue;

    const events: Array<{
      id: string;
      buyoutId: string;
      emailId: string | null;
      eventType: string;
      summary: string;
      detail: string;
      createdBy: string | null;
      createdAt: Date;
    }> = [];

    if (buyout.inquiry) {
      events.push({
        id: randomUUID(),
        buyoutId: buyout.id,
        emailId: null,
        eventType: "INQUIRY_RECEIVED",
        summary: `Inquiry received from ${buyout.inquiry.clientName} via ${buyout.inquiry.source}`,
        detail: JSON.stringify({
          source: buyout.inquiry.source,
          eventType: buyout.inquiry.eventType,
          preferredDates: buyout.inquiry.preferredDates,
          preferredLocation: buyout.inquiry.preferredLocation,
          guestCount: buyout.inquiry.guestCountEstimate
        }),
        createdBy: null,
        createdAt: buyout.inquiry.createdAt
      });
    }

    if (buyout.createdAt && (!buyout.inquiry || buyout.createdAt.getTime() !== buyout.inquiry.createdAt.getTime())) {
      events.push({
        id: randomUUID(),
        buyoutId: buyout.id,
        emailId: null,
        eventType: "BUYOUT_CREATED",
        summary: `Buyout record created for ${buyout.displayName}`,
        detail: JSON.stringify({
          source: buyout.legacyMondayItemId ? "monday-import" : "platform",
          lifecycleStage: buyout.lifecycleStage,
          legacyItemId: buyout.legacyMondayItemId
        }),
        createdBy: null,
        createdAt: buyout.createdAt
      });
    }

    for (const step of buyout.workflowSteps) {
      if (step.isComplete && step.completedAt) {
        events.push({
          id: randomUUID(),
          buyoutId: buyout.id,
          emailId: null,
          eventType: "WORKFLOW_STEP_COMPLETED",
          summary: `Checklist: ${step.label} completed`,
          detail: JSON.stringify({
            stepKey: step.stepKey,
            stepGroup: step.stepGroup,
            completedBy: step.completedBy
          }),
          createdBy: step.completedBy,
          createdAt: step.completedAt
        });
      }
    }

    for (const email of buyout.emails) {
      if (email.sentAt) {
        events.push({
          id: randomUUID(),
          buyoutId: buyout.id,
          emailId: email.id,
          eventType: "EMAIL_SENT",
          summary: `Email sent: ${email.subject}`,
          detail: JSON.stringify({
            templateKey: email.templateKey,
            sentBy: email.sentBy,
            status: email.status,
            providerMessageId: email.providerMessageId
          }),
          createdBy: email.sentBy,
          createdAt: email.sentAt
        });
      }
    }

    if (buyout.lastActionAt) {
      const hasMatchingEvent = events.some(
        (e) => Math.abs(e.createdAt.getTime() - buyout.lastActionAt!.getTime()) < 60000
      );

      if (!hasMatchingEvent) {
        events.push({
          id: randomUUID(),
          buyoutId: buyout.id,
          emailId: null,
          eventType: "LAST_ACTION_RECORDED",
          summary: "Last team action recorded",
          detail: JSON.stringify({ source: "monday-import" }),
          createdBy: null,
          createdAt: buyout.lastActionAt
        });
      }
    }

    events.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

    for (const event of events) {
      await prisma.$executeRawUnsafe(
        `INSERT INTO "BuyoutEvent" ("id", "buyoutId", "emailId", "eventType", "summary", "detail", "createdBy", "createdAt")
         VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8)
         ON CONFLICT DO NOTHING`,
        event.id,
        event.buyoutId,
        event.emailId,
        event.eventType,
        event.summary,
        event.detail,
        event.createdBy,
        event.createdAt
      );
      created++;
    }
  }

  return NextResponse.json({
    message: `Backfilled ${created} activity events across ${buyouts.length} buyouts.`,
    buyoutsProcessed: buyouts.length,
    eventsCreated: created
  });
}
