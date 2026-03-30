import { NextResponse } from "next/server";

import { hasDatabaseUrl, prisma } from "@/lib/prisma";

export type FeedbackRecord = {
  id: string;
  rating: number | null;
  experienceText: string | null;
  instructorRating: number | null;
  venueRating: number | null;
  wouldRecommend: boolean | null;
  highlights: string | null;
  improvements: string | null;
  clientName: string | null;
  clientEmail: string | null;
  isSubmitted: boolean;
  submittedAt: string | null;
};

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;

  if (!hasDatabaseUrl()) {
    return NextResponse.json({ feedback: null, feedbackUrl: null });
  }

  try {
    // Get feedback token for this buyout
    const tokens = (await prisma.$queryRawUnsafe(
      `SELECT "feedbackToken" FROM "Buyout" WHERE "id" = $1 LIMIT 1`,
      id
    )) as Array<{ feedbackToken: string | null }>;

    const token = tokens[0]?.feedbackToken;
    const feedbackUrl = token
      ? `${process.env.NEXT_PUBLIC_BASE_URL ?? "https://buyouts.thestudiopilates.com"}/feedback?token=${token}`
      : null;

    // Get submitted feedback
    const rows = (await prisma.$queryRawUnsafe(
      `SELECT "id", "rating", "experienceText", "instructorRating", "venueRating",
              "wouldRecommend", "highlights", "improvements", "clientName", "clientEmail",
              "isSubmitted", "submittedAt"
       FROM "EventFeedback"
       WHERE "buyoutId" = $1
       ORDER BY "createdAt" DESC`,
      id
    )) as Array<{
      id: string;
      rating: number | null;
      experienceText: string | null;
      instructorRating: number | null;
      venueRating: number | null;
      wouldRecommend: boolean | null;
      highlights: string | null;
      improvements: string | null;
      clientName: string | null;
      clientEmail: string | null;
      isSubmitted: boolean;
      submittedAt: Date | null;
    }>;

    const feedback: FeedbackRecord[] = rows.map((r) => ({
      ...r,
      submittedAt: r.submittedAt?.toISOString() ?? null
    }));

    return NextResponse.json({ feedback: feedback[0] ?? null, feedbackUrl, allFeedback: feedback });
  } catch {
    return NextResponse.json({ feedback: null, feedbackUrl: null });
  }
}
