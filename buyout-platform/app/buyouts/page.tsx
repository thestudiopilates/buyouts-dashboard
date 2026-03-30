import { PortalShell } from "@/components/portal-shell";
import { OperationsDashboard } from "@/components/operations-dashboard";
import { listBuyouts } from "@/lib/buyouts";
import type { BuyoutSummary } from "@/lib/types";

export const dynamic = "force-dynamic";

type TodoItem = {
  id: string;
  buyoutId: string;
  buyoutName: string;
  label: string;
  dueLabel: string;
  urgency: "overdue" | "today" | "soon" | "this-week";
};

function deriveThisWeekTodos(buyouts: BuyoutSummary[]): TodoItem[] {
  const TERMINAL = new Set(["Complete", "Cancelled", "DOA", "Not Possible", "On Hold"]);
  const active = buyouts.filter((b) => !TERMINAL.has(b.lifecycleStage));
  const items: TodoItem[] = [];

  for (const b of active) {
    const cd = b.countdownDays;
    const eventSoon = cd !== null && cd >= 0 && cd <= 7;

    // 1. Response overdue — we're waiting too long and ball is on client
    if (b.responseUrgency === "critical" || b.responseUrgency === "overdue") {
      items.push({
        id: `${b.id}-response`,
        buyoutId: b.id,
        buyoutName: b.name,
        label: `Follow up with ${b.name} — no client response in ${b.daysWaiting} days`,
        dueLabel: "Overdue",
        urgency: "overdue"
      });
    }

    // 2. Team action needed (ball in our court, waiting > 2 days)
    if (b.ballInCourt === "Team" && b.daysWaiting > 2 && b.responseUrgency !== "critical" && b.responseUrgency !== "overdue") {
      items.push({
        id: `${b.id}-team-action`,
        buyoutId: b.id,
        buyoutName: b.name,
        label: `${b.nextAction} — ${b.name}`,
        dueLabel: b.daysWaiting > 5 ? `${b.daysWaiting}d waiting` : "Action needed",
        urgency: b.daysWaiting > 5 ? "overdue" : "this-week"
      });
    }

    // 3. Final confirmation not sent — event within 2 days
    if (eventSoon && cd !== null && cd <= 2 && !b.sentTemplateIds.includes("t11")) {
      items.push({
        id: `${b.id}-final-confirm`,
        buyoutId: b.id,
        buyoutName: b.name,
        label: `Send final confirmation email to ${b.name}`,
        dueLabel: cd === 0 ? "Today" : cd === 1 ? "Tomorrow" : `${cd} days`,
        urgency: cd === 0 ? "today" : "soon"
      });
    }

    // 4. Outstanding balance — event within 7 days
    if (eventSoon && b.outstanding > 0) {
      const fmt = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(b.outstanding);
      items.push({
        id: `${b.id}-balance`,
        buyoutId: b.id,
        buyoutName: b.name,
        label: `Collect ${fmt} balance from ${b.name}`,
        dueLabel: cd === 0 ? "Today" : cd === 1 ? "Tomorrow" : `${cd} days`,
        urgency: cd !== null && cd <= 1 ? "today" : "soon"
      });
    }

    // 5. Signups incomplete — event within 7 days
    if (eventSoon && b.signupLink && b.capacity > 0 && b.signups < b.capacity) {
      items.push({
        id: `${b.id}-signups`,
        buyoutId: b.id,
        buyoutName: b.name,
        label: `Chase signups for ${b.name} — ${b.signups}/${b.capacity} registered`,
        dueLabel: cd === 0 ? "Today" : cd === 1 ? "Tomorrow" : `${cd} days`,
        urgency: cd !== null && cd <= 2 ? "soon" : "this-week"
      });
    }

    // 6. Waivers incomplete — event within 7 days (inferred from workflow)
    const waiversDone = b.workflow?.find((s) => s.key === "all-waivers-signed")?.complete ?? false;
    if (eventSoon && !waiversDone && b.signups > 0) {
      items.push({
        id: `${b.id}-waivers`,
        buyoutId: b.id,
        buyoutName: b.name,
        label: `Confirm all waivers signed for ${b.name}`,
        dueLabel: cd === 0 ? "Today" : cd === 1 ? "Tomorrow" : `${cd} days`,
        urgency: cd !== null && cd <= 2 ? "soon" : "this-week"
      });
    }

    // 7. Event happening this week — surface as awareness item
    if (eventSoon && cd !== null) {
      const dateLabel = cd === 0 ? "Today" : cd === 1 ? "Tomorrow" : `${cd}d`;
      items.push({
        id: `${b.id}-event`,
        buyoutId: b.id,
        buyoutName: b.name,
        label: `Event: ${b.name}${b.startTime ? ` at ${b.startTime}` : ""} — ${b.location}`,
        dueLabel: dateLabel,
        urgency: cd === 0 ? "today" : cd <= 2 ? "soon" : "this-week"
      });
    }
  }

  // Sort: overdue → today → soon → this-week, then by buyout name
  const rank = { overdue: 0, today: 1, soon: 2, "this-week": 3 };
  items.sort((a, b) => rank[a.urgency] - rank[b.urgency] || a.buyoutName.localeCompare(b.buyoutName));

  // Deduplicate by id
  return items.filter((item, i, arr) => arr.findIndex((x) => x.id === item.id) === i);
}

const URGENCY_COLORS: Record<TodoItem["urgency"], { bg: string; dot: string; text: string }> = {
  overdue:    { bg: "#FFF0EE", dot: "#E8581B", text: "#C0351A" },
  today:      { bg: "#FFF8EE", dot: "#F2A408", text: "#9B6200" },
  soon:       { bg: "#F0F7F8", dot: "#006976", text: "#004D57" },
  "this-week": { bg: "#F5F6F0", dot: "#797F5D", text: "#4E5238" }
};

export default async function BuyoutsPage() {
  const buyouts = await listBuyouts();
  const todos = deriveThisWeekTodos(buyouts);

  return (
    <div className="shell">
      <PortalShell activeHref="/buyouts">
        <div className="section-block">
          <div className="portal-topbar">
            <div>
              <p className="eyebrow">Buyout Operations</p>
              <h1 className="page-title" style={{ fontSize: "2.4rem" }}>
                Pipeline &amp; Event Management
              </h1>
            </div>
          </div>

          {/* ── This Week To-Do ─────────────────────────────── */}
          <div style={{ margin: "1rem 0 1.5rem", background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
            <div style={{ padding: "14px 20px 12px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontFamily: "Georgia, serif", fontWeight: 700, fontSize: "0.92rem", color: "var(--coffee)" }}>This Week</span>
              {todos.length > 0 && (
                <span style={{ background: "var(--cherry)", color: "#fff", borderRadius: 999, fontSize: "0.68rem", fontWeight: 700, padding: "2px 7px", lineHeight: 1.4 }}>
                  {todos.length}
                </span>
              )}
            </div>
            {todos.length === 0 ? (
              <div style={{ padding: "18px 20px", fontSize: "0.83rem", color: "var(--warmGrey)" }}>
                No operator actions due this week.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column" }}>
                {todos.map((item, i) => {
                  const style = URGENCY_COLORS[item.urgency];
                  return (
                    <div
                      key={item.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        padding: "10px 20px",
                        borderBottom: i < todos.length - 1 ? "1px solid var(--border)" : undefined,
                        background: style.bg
                      }}
                    >
                      <div style={{ width: 8, height: 8, borderRadius: "50%", background: style.dot, flexShrink: 0 }} />
                      <div style={{ flex: 1, fontSize: "0.82rem", color: style.text, lineHeight: 1.4 }}>
                        {item.label}
                      </div>
                      <div style={{ fontSize: "0.72rem", fontWeight: 700, color: style.dot, whiteSpace: "nowrap" }}>
                        {item.dueLabel}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <section style={{ marginTop: "0.5rem" }}>
            <OperationsDashboard buyouts={buyouts} />
          </section>
        </div>
      </PortalShell>
    </div>
  );
}
