import { randomUUID } from "crypto";

import { NextRequest, NextResponse } from "next/server";

import { hasDatabaseUrl, prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * GET /api/feedback?token=xxx — Load feedback form data for a given token (public)
 */
export async function GET(request: NextRequest) {
  if (!hasDatabaseUrl()) {
    return NextResponse.json({ error: "Database not configured." }, { status: 500 });
  }

  const token = request.nextUrl.searchParams.get("token");
  if (!token) {
    return NextResponse.json({ error: "Token required." }, { status: 400 });
  }

  try {
    // Find buyout by feedback token
    const buyouts = (await prisma.$queryRawUnsafe(
      `SELECT b."id", b."displayName", b."eventDate", l."name" AS "locationName",
              i."clientName", i."clientEmail"
       FROM "Buyout" b
       LEFT JOIN "Location" l ON l."id" = b."locationId"
       LEFT JOIN "BuyoutInquiry" i ON i."id" = b."inquiryId"
       WHERE b."feedbackToken" = $1
       LIMIT 1`,
      token
    )) as Array<{
      id: string;
      displayName: string;
      eventDate: Date | null;
      locationName: string | null;
      clientName: string | null;
      clientEmail: string | null;
    }>;

    if (buyouts.length === 0) {
      return NextResponse.json({ error: "Invalid feedback link." }, { status: 404 });
    }

    const buyout = buyouts[0];

    // Check for existing feedback
    const existing = (await prisma.$queryRawUnsafe(
      `SELECT "id", "rating", "experienceText", "instructorRating", "venueRating",
              "wouldRecommend", "highlights", "improvements", "clientName", "clientEmail",
              "isSubmitted", "submittedAt"
       FROM "EventFeedback"
       WHERE "buyoutId" = $1
       ORDER BY "createdAt" DESC
       LIMIT 1`,
      buyout.id
    )) as Array<Record<string, unknown>>;

    return NextResponse.json({
      buyout: {
        id: buyout.id,
        name: buyout.displayName,
        eventDate: buyout.eventDate,
        location: buyout.locationName,
        clientName: buyout.clientName,
        clientEmail: buyout.clientEmail
      },
      feedback: existing[0] ?? null
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load feedback.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * POST /api/feedback — Submit feedback (public, token-authenticated)
 */
export async function POST(request: NextRequest) {
  if (!hasDatabaseUrl()) {
    return NextResponse.json({ error: "Database not configured." }, { status: 500 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    token?: string;
    rating?: number;
    experienceText?: string;
    instructorRating?: number;
    venueRating?: number;
    wouldRecommend?: boolean;
    highlights?: string;
    improvements?: string;
    clientName?: string;
    clientEmail?: string;
  };

  if (!body.token) {
    return NextResponse.json({ error: "Token required." }, { status: 400 });
  }

  try {
    // Validate token
    const buyouts = (await prisma.$queryRawUnsafe(
      `SELECT "id", "displayName" FROM "Buyout" WHERE "feedbackToken" = $1 LIMIT 1`,
      body.token
    )) as Array<{ id: string; displayName: string }>;

    if (buyouts.length === 0) {
      return NextResponse.json({ error: "Invalid feedback link." }, { status: 404 });
    }

    const buyoutId = buyouts[0].id;

    // Upsert feedback
    const existingRows = (await prisma.$queryRawUnsafe(
      `SELECT "id" FROM "EventFeedback" WHERE "buyoutId" = $1 LIMIT 1`,
      buyoutId
    )) as Array<{ id: string }>;

    if (existingRows.length > 0) {
      // Update existing
      await prisma.$executeRawUnsafe(
        `UPDATE "EventFeedback" SET
          "rating" = $2, "experienceText" = $3, "instructorRating" = $4,
          "venueRating" = $5, "wouldRecommend" = $6, "highlights" = $7,
          "improvements" = $8, "clientName" = $9, "clientEmail" = $10,
          "isSubmitted" = true, "submittedAt" = NOW()
         WHERE "id" = $1`,
        existingRows[0].id,
        body.rating ?? null,
        body.experienceText ?? null,
        body.instructorRating ?? null,
        body.venueRating ?? null,
        body.wouldRecommend ?? null,
        body.highlights ?? null,
        body.improvements ?? null,
        body.clientName ?? null,
        body.clientEmail ?? null
      );
    } else {
      // Insert new
      await prisma.$executeRawUnsafe(
        `INSERT INTO "EventFeedback" ("id","buyoutId","token","rating","experienceText",
          "instructorRating","venueRating","wouldRecommend","highlights","improvements",
          "clientName","clientEmail","isSubmitted","submittedAt")
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,true,NOW())`,
        randomUUID(),
        buyoutId,
        body.token,
        body.rating ?? null,
        body.experienceText ?? null,
        body.instructorRating ?? null,
        body.venueRating ?? null,
        body.wouldRecommend ?? null,
        body.highlights ?? null,
        body.improvements ?? null,
        body.clientName ?? null,
        body.clientEmail ?? null
      );
    }

    // Log as BuyoutEvent
    await prisma.$executeRawUnsafe(
      `INSERT INTO "BuyoutEvent" ("id","buyoutId","eventType","summary","detail","createdBy")
       VALUES ($1,$2,'FEEDBACK_RECEIVED',$3,$4::jsonb,$5)`,
      randomUUID(),
      buyoutId,
      `Feedback received — ${body.rating ?? "?"}/5 stars`,
      JSON.stringify({
        rating: body.rating,
        instructorRating: body.instructorRating,
        venueRating: body.venueRating,
        wouldRecommend: body.wouldRecommend
      }),
      body.clientName ?? "client"
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to save feedback.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
