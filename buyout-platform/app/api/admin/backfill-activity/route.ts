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
      emails: { orderBy: { createdAt: "asc" } },
      workflowSteps: { orderBy: { createdAt: "asc" } }
    }
  });

  let created = 0;
  const errors: string[] = [];

  for (const buyout of buyouts) {
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

    const fallbackDate = buyout.createdAt ?? new Date();

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
          preferredLocation: buyout.inquiry.preferredLocation
        }),
        createdBy: null,
        createdAt: buyout.inquiry.createdAt ?? fallbackDate
      });
    }

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
      createdAt: fallbackDate
    });

    for (const step of buyout.workflowSteps) {
      if (step.isComplete) {
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
          createdAt: step.completedAt ?? step.updatedAt ?? fallbackDate
        });
      }
    }

    for (const email of buyout.emails) {
      events.push({
        id: randomUUID(),
        buyoutId: buyout.id,
        emailId: email.id,
        eventType: "EMAIL_SENT",
        summary: `Email sent: ${email.subject ?? email.templateKey}`,
        detail: JSON.stringify({
          templateKey: email.templateKey,
          sentBy: email.sentBy,
          status: email.status
        }),
        createdBy: email.sentBy,
        createdAt: email.sentAt ?? email.createdAt ?? fallbackDate
      });
    }

    if (buyout.lastActionAt) {
      events.push({
        id: randomUUID(),
        buyoutId: buyout.id,
        emailId: null,
        eventType: "LAST_ACTION_RECORDED",
        summary: "Last team action recorded (from Monday)",
        detail: JSON.stringify({ source: "monday-import" }),
        createdBy: null,
        createdAt: buyout.lastActionAt
      });
    }

    if (buyout.eventDate) {
      events.push({
        id: randomUUID(),
        buyoutId: buyout.id,
        emailId: null,
        eventType: "EVENT_DATE_SET",
        summary: `Event date: ${buyout.eventDate.toISOString().slice(0, 10)}`,
        detail: JSON.stringify({
          eventDate: buyout.eventDate.toISOString(),
          startTime: buyout.startTime,
          endTime: buyout.endTime
        }),
        createdBy: null,
        createdAt: buyout.eventDate
      });
    }

    events.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

    for (const event of events) {
      try {
        await prisma.$executeRawUnsafe(
          `INSERT INTO "BuyoutEvent" ("id", "buyoutId", "emailId", "eventType", "summary", "detail", "createdBy", "createdAt")
           VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8)`,
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
      } catch (err) {
        errors.push(`${buyout.displayName}: ${err instanceof Error ? err.message : "unknown"}`);
      }
    }
  }

  return NextResponse.json({
    message: `Backfilled ${created} activity events across ${buyouts.length} buyouts.`,
    buyoutsProcessed: buyouts.length,
    eventsCreated: created,
    errors: errors.slice(0, 10)
  });
}
