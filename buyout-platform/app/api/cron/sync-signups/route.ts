import { randomUUID } from "crypto";

import { NextResponse } from "next/server";

import { getMomenceEventById, resolveSignupLinkToEventId } from "@/lib/momence";
import { hasDatabaseUrl, prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Terminal stages — never sync these
const SKIP_STAGES = new Set(["COMPLETE", "CANCELLED", "DOA", "NOT_POSSIBLE"]);

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!hasDatabaseUrl()) {
    return NextResponse.json({ error: "Database required." }, { status: 400 });
  }

  // Find active buyouts that have a signup link and are not terminal or complete
  const buyouts = await prisma.$queryRawUnsafe(`
    SELECT
      b.id,
      b."lifecycleStage",
      b."signupCount",
      b."sourceSnapshot"
    FROM "Buyout" b
    WHERE
      b."lifecycleStage" NOT IN ('COMPLETE','CANCELLED','DOA','NOT_POSSIBLE')
      AND b."sourceSnapshot" IS NOT NULL
  `) as Array<{
    id: string;
    lifecycleStage: string;
    signupCount: number;
    sourceSnapshot: unknown;
  }>;

  // Extract signupLink (and signupLink2) from sourceSnapshot.values
  const eligible: Array<{ id: string; signupLink: string; signupLink2: string | null }> = [];

  for (const buyout of buyouts) {
    if (SKIP_STAGES.has(buyout.lifecycleStage)) continue;

    const snapshot = buyout.sourceSnapshot;
    if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) continue;

    const values = (snapshot as Record<string, unknown>).values;
    if (!values || typeof values !== "object" || Array.isArray(values)) continue;

    const vals = values as Record<string, unknown>;
    const signupLink = typeof vals.signupLink === "string" ? vals.signupLink.trim() : "";
    const signupLink2 = typeof vals.signupLink2 === "string" ? vals.signupLink2.trim() : null;

    if (!signupLink) continue;
    eligible.push({ id: buyout.id, signupLink, signupLink2: signupLink2 || null });
  }

  let synced = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const { id, signupLink, signupLink2 } of eligible) {
    try {
      // Resolve the event ID once (surgical — no bulk listing)
      const eventId = await resolveSignupLinkToEventId(signupLink);
      if (!eventId) { failed++; continue; }

      const classInfo = await getMomenceEventById(eventId);
      if (!classInfo) { failed++; continue; }

      let totalSignups = classInfo.signupCount;

      // If there's a second signup link (back-to-back or full-location buyout), add its count
      if (signupLink2) {
        const eventId2 = await resolveSignupLinkToEventId(signupLink2);
        if (eventId2) {
          const classInfo2 = await getMomenceEventById(eventId2);
          if (classInfo2) totalSignups += classInfo2.signupCount;
        }
      }

      // Update signupCount on the Buyout record
      await prisma.buyout.update({
        where: { id },
        data: { signupCount: totalSignups }
      });

      // Record a lightweight audit event so the activity log reflects the sync
      await prisma.$executeRawUnsafe(
        `INSERT INTO "BuyoutEvent" ("id","buyoutId","eventType","summary","detail","createdBy")
         VALUES ($1,$2,'SIGNUP_SYNC',$3,$4::jsonb,$5)`,
        randomUUID(),
        id,
        `Signup count updated: ${totalSignups} registered`,
        JSON.stringify({ signupCount: totalSignups, eventId, syncedAt: new Date().toISOString() }),
        "cron"
      );

      synced++;
    } catch (err) {
      failed++;
      errors.push(`${id}: ${err instanceof Error ? err.message : "unknown"}`);
    }
  }

  return NextResponse.json({
    eligible: eligible.length,
    synced,
    failed,
    errors: errors.slice(0, 5)
  });
}
