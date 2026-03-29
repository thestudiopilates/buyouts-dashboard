import Link from "next/link";

import { PortalShell } from "@/components/portal-shell";
import { listBuyouts } from "@/lib/buyouts";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const buyouts = await listBuyouts();
  const active = buyouts.filter((b) => !["Complete", "Cancelled", "DOA", "Not Possible"].includes(b.lifecycleStage));
  const needsAttention = active.filter((b) => b.daysWaiting > 5 || ["At risk", "Major issue"].includes(b.trackingHealth));
  const thisWeek = active.filter((b) => b.countdownDays !== null && b.countdownDays >= 0 && b.countdownDays <= 7);
  const pipeline = active.reduce((sum, b) => sum + b.total, 0);
  const collected = active.reduce((sum, b) => sum + b.amountPaid, 0);

  return (
    <div className="shell">
      <PortalShell activeHref="/dashboard">
        <div className="section-block">
          <p className="eyebrow">Management Portal</p>
          <h1 className="page-title" style={{ fontSize: "2.5rem" }}>
            The Studio Pilates
          </h1>
          <p className="section-copy">
            Operations hub for buyouts, front desk scheduling, and event management.
          </p>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginTop: 24, marginBottom: 32 }}>
            <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 14, padding: "20px 24px" }}>
              <div style={{ fontSize: "2rem", fontWeight: 700, color: "var(--seaglass)" }}>{active.length}</div>
              <div style={{ fontSize: "0.82rem", color: "var(--warmGrey)" }}>Active Buyouts</div>
            </div>
            <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 14, padding: "20px 24px" }}>
              <div style={{ fontSize: "2rem", fontWeight: 700, color: thisWeek.length > 0 ? "var(--sunshine)" : "var(--seaglass)" }}>{thisWeek.length}</div>
              <div style={{ fontSize: "0.82rem", color: "var(--warmGrey)" }}>This Week</div>
            </div>
            <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 14, padding: "20px 24px" }}>
              <div style={{ fontSize: "2rem", fontWeight: 700, color: needsAttention.length > 0 ? "var(--cherry)" : "var(--seaglass)" }}>{needsAttention.length}</div>
              <div style={{ fontSize: "0.82rem", color: "var(--warmGrey)" }}>Needs Attention</div>
            </div>
            <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 14, padding: "20px 24px" }}>
              <div style={{ fontSize: "2rem", fontWeight: 700, color: "var(--terracotta)" }}>${(pipeline / 1000).toFixed(1)}k</div>
              <div style={{ fontSize: "0.82rem", color: "var(--warmGrey)" }}>${(collected / 1000).toFixed(1)}k collected</div>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 16 }}>
            <Link href="/buyouts" style={{ textDecoration: "none" }}>
              <div style={{ background: "var(--coffee)", borderRadius: 14, padding: "32px 28px", color: "var(--oat)", transition: "opacity 0.2s" }}>
                <div style={{ fontFamily: "Georgia, serif", fontSize: "1.4rem", fontWeight: 700, marginBottom: 8 }}>Buyout Operations</div>
                <div style={{ fontSize: "0.88rem", color: "var(--warmGrey)", lineHeight: 1.5 }}>
                  Full pipeline view with lifecycle tracking, email sends, checklist management, and payment monitoring.
                </div>
                <div style={{ marginTop: 16, fontSize: "0.82rem", fontWeight: 600, color: "var(--terracotta)" }}>{active.length} active events →</div>
              </div>
            </Link>

            <Link href="/front-desk" style={{ textDecoration: "none" }}>
              <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 14, padding: "32px 28px", transition: "opacity 0.2s" }}>
                <div style={{ fontFamily: "Georgia, serif", fontSize: "1.4rem", fontWeight: 700, color: "var(--coffee)", marginBottom: 8 }}>Front Desk Schedule</div>
                <div style={{ fontSize: "0.88rem", color: "var(--warmGrey)", lineHeight: 1.5 }}>
                  Upcoming buyout schedule, desk assignments, shift coverage, and day-of event details for the front desk team.
                </div>
                <div style={{ marginTop: 16, fontSize: "0.82rem", fontWeight: 600, color: "var(--seaglass)" }}>Coming soon →</div>
              </div>
            </Link>

            <Link href="/settings" style={{ textDecoration: "none" }}>
              <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 14, padding: "32px 28px", transition: "opacity 0.2s" }}>
                <div style={{ fontFamily: "Georgia, serif", fontSize: "1.4rem", fontWeight: 700, color: "var(--coffee)", marginBottom: 8 }}>Email Templates</div>
                <div style={{ fontSize: "0.88rem", color: "var(--warmGrey)", lineHeight: 1.5 }}>
                  Edit and preview all 17 buyout email templates. Manage subject lines, body copy, and workflow effects.
                </div>
                <div style={{ marginTop: 16, fontSize: "0.82rem", fontWeight: 600, color: "var(--seaglass)" }}>Manage templates →</div>
              </div>
            </Link>

            <Link href="/buyouts/inquire" style={{ textDecoration: "none" }}>
              <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 14, padding: "32px 28px", transition: "opacity 0.2s" }}>
                <div style={{ fontFamily: "Georgia, serif", fontSize: "1.4rem", fontWeight: 700, color: "var(--coffee)", marginBottom: 8 }}>Public Inquiry Form</div>
                <div style={{ fontSize: "0.88rem", color: "var(--warmGrey)", lineHeight: 1.5 }}>
                  Preview the client-facing intake form. Submissions create new buyouts automatically and notify the team via email.
                </div>
                <div style={{ marginTop: 16, fontSize: "0.82rem", fontWeight: 600, color: "var(--seaglass)" }}>Preview form →</div>
              </div>
            </Link>
          </div>
        </div>
      </PortalShell>
    </div>
  );
}
