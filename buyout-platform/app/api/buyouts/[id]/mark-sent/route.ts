import { randomUUID } from "crypto";

import { NextResponse } from "next/server";

import { getBuyout } from "@/lib/buyouts";
import { ensureEmailInfrastructure } from "@/lib/email-templates";
import { hasDatabaseUrl, prisma } from "@/lib/prisma";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const body = (await request.json().catch(() => ({}))) as {
    templateKey?: string;
    unmark?: boolean;
  };

  if (typeof body.templateKey !== "string") {
    return NextResponse.json({ error: "templateKey is required." }, { status: 400 });
  }

  try {
    if (!hasDatabaseUrl()) {
      return NextResponse.json({ error: "Database required." }, { status: 400 });
    }

    const buyout = await getBuyout(id);
    if (!buyout) {
      return NextResponse.json({ error: "Buyout not found." }, { status: 404 });
    }

    if (body.unmark) {
      await prisma.buyoutEmail.deleteMany({
        where: {
          buyoutId: id,
          templateKey: body.templateKey,
          sentBy: "marked-offline"
        }
      });
    } else {
      const existing = await prisma.buyoutEmail.findFirst({
        where: {
          buyoutId: id,
          templateKey: body.templateKey,
          status: "SENT"
        }
      });

      if (!existing) {
        await prisma.buyoutEmail.create({
          data: {
            buyoutId: id,
            templateKey: body.templateKey,
            subject: `[Marked as sent offline] ${body.templateKey}`,
            status: "SENT",
            sentAt: new Date(),
            sentBy: "marked-offline"
          }
        });

        await ensureEmailInfrastructure();
        await prisma.$executeRawUnsafe(
          `INSERT INTO "BuyoutEvent" ("id", "buyoutId", "eventType", "summary", "detail", "createdBy")
           VALUES ($1, $2, 'EMAIL_MARKED_SENT', $3, $4::jsonb, $5)`,
          randomUUID(),
          id,
          `${body.templateKey} marked as sent (offline)`,
          JSON.stringify({ templateKey: body.templateKey, method: "offline" }),
          "dashboard"
        );
      }
    }

    const updated = await getBuyout(id);
    return NextResponse.json({ buyout: updated });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to update.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
