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

/**
 * Milestone deadlines: workflow steps that should be done by X days before event.
 * When a step isn't complete and the countdown has crossed its threshold, a todo fires.
 */
const MILESTONE_DEADLINES: Array<{
  stepKey: string;
  daysBefore: number;
  label: (name: string) => string;
}> = [
  { stepKey: "deposit-link-sent-and-terms-shared", daysBefore: 21, label: (n) => `Send payment link & terms to ${n}` },
  { stepKey: "instructor-finalized", daysBefore: 14, label: (n) => `Confirm instructor for ${n}` },
  { stepKey: "momence-class-created", daysBefore: 12, label: (n) => `Create Momence event for ${n}` },
  { stepKey: "momence-link-sign-up-sent", daysBefore: 10, label: (n) => `Send signup link to ${n}` },
  { stepKey: "all-attendees-registered", daysBefore: 5, label: (n) => `Ensure all attendees registered for ${n}` },
  { stepKey: "all-waivers-signed", daysBefore: 3, label: (n) => `Confirm all waivers signed for ${n}` },
  { stepKey: "front-desk-assigned", daysBefore: 3, label: (n) => `Assign front desk for ${n}` },
  { stepKey: "final-confirmation-emails-sent", daysBefore: 2, label: (n) => `Send final confirmation email for ${n}` },
];

function to12h(time: string): string {
  const m = time.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return time;
  let h = parseInt(m[1], 10);
  const min = m[2];
  const ampm = h >= 12 ? "PM" : "AM";
  if (h === 0) h = 12;
  else if (h > 12) h -= 12;
  return `${h}:${min} ${ampm}`;
}

function deriveThisWeekTodos(buyouts: BuyoutSummary[]): TodoItem[] {
  const TERMINAL = new Set(["Complete", "Cancelled", "DOA", "Not Possible", "On Hold"]);
  const active = buyouts.filter((b) => !TERMINAL.has(b.lifecycleStage));
  const items: TodoItem[] = [];
  const now = Date.now();

  for (const b of active) {
    const cd = b.countdownDays;
    const eventSoon = cd !== null && cd >= 0 && cd <= 7;
    const completedKeys = new Set(b.workflow?.filter((s) => s.complete).map((s) => s.key) ?? []);

    // Adaptive waiting threshold: closer events need faster action
    const waitThreshold = cd !== null && cd <= 3 ? 1 : cd !== null && cd <= 7 ? 1.5 : 2;

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

    // 2. Team action needed (ball in our court, adaptive threshold)
    if (b.ballInCourt === "Team" && b.daysWaiting > waitThreshold && b.responseUrgency !== "critical" && b.responseUrgency !== "overdue") {
      const isUrgent = b.daysWaiting > 5 || (cd !== null && cd <= 3 && b.daysWaiting > 1);
      items.push({
        id: `${b.id}-team-action`,
        buyoutId: b.id,
        buyoutName: b.name,
        label: `${b.nextAction} — ${b.name}`,
        dueLabel: isUrgent ? `${b.daysWaiting}d waiting` : "Action needed",
        urgency: isUrgent ? "overdue" : "this-week"
      });
    }

    // 3. TBD buyouts need a date pinned down
    if (b.eventDate === "TBD") {
      const daysSinceInquiry = b.inquiryDate ? Math.floor((now - new Date(b.inquiryDate).getTime()) / 86400000) : null;
      if (daysSinceInquiry === null || daysSinceInquiry >= 5) {
        items.push({
          id: `${b.id}-tbd-date`,
          buyoutId: b.id,
          buyoutName: b.name,
          label: `Pin down event date for ${b.name}${daysSinceInquiry ? ` — ${daysSinceInquiry}d since inquiry` : ""}`,
          dueLabel: daysSinceInquiry && daysSinceInquiry > 10 ? "Overdue" : "Needs date",
          urgency: daysSinceInquiry && daysSinceInquiry > 10 ? "overdue" : "soon"
        });
      }
      continue; // No countdown-based todos for TBD events
    }

    // 4. Milestone-based reminders — proactive, fires when countdown crosses threshold
    if (cd !== null && cd >= 0) {
      for (const milestone of MILESTONE_DEADLINES) {
        if (completedKeys.has(milestone.stepKey)) continue;
        if (cd > milestone.daysBefore) continue;
        // Only show if this step is relevant to current stage (don't nag about signups in Inquiry stage)
        const stepExists = b.workflow?.some((s) => s.key === milestone.stepKey);
        if (!stepExists) continue;

        const daysLate = milestone.daysBefore - cd;
        items.push({
          id: `${b.id}-milestone-${milestone.stepKey}`,
          buyoutId: b.id,
          buyoutName: b.name,
          label: milestone.label(b.name),
          dueLabel: daysLate > 0 ? `${daysLate}d overdue` : cd === 0 ? "Today" : `${cd}d left`,
          urgency: daysLate > 3 ? "overdue" : daysLate > 0 ? "soon" : "this-week"
        });
      }
    }

    // 5. Outstanding balance — event within 14 days (expanded from 7)
    if (cd !== null && cd >= 0 && cd <= 14 && b.outstanding > 0) {
      const fmt = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(b.outstanding);
      items.push({
        id: `${b.id}-balance`,
        buyoutId: b.id,
        buyoutName: b.name,
        label: `Collect ${fmt} balance from ${b.name}`,
        dueLabel: cd === 0 ? "Today" : cd === 1 ? "Tomorrow" : `${cd} days`,
        urgency: cd <= 1 ? "today" : cd <= 3 ? "soon" : "this-week"
      });
    }

    // 6. Signups incomplete — event within 10 days (expanded from 7)
    if (cd !== null && cd >= 0 && cd <= 10 && b.signupLink && b.capacity > 0 && b.signups < b.capacity) {
      items.push({
        id: `${b.id}-signups`,
        buyoutId: b.id,
        buyoutName: b.name,
        label: `Chase signups for ${b.name} — ${b.signups}/${b.capacity} registered`,
        dueLabel: cd === 0 ? "Today" : cd === 1 ? "Tomorrow" : `${cd} days`,
        urgency: cd <= 2 ? "soon" : "this-week"
      });
    }

    // 7. Event happening this week — surface as awareness item
    if (eventSoon && cd !== null) {
      const dateLabel = cd === 0 ? "Today" : cd === 1 ? "Tomorrow" : `${cd}d`;
      items.push({
        id: `${b.id}-event`,
        buyoutId: b.id,
        buyoutName: b.name,
        label: `Event: ${b.name}${b.startTime ? ` at ${to12h(b.startTime)}` : ""} — ${b.location}`,
        dueLabel: dateLabel,
        urgency: cd === 0 ? "today" : cd <= 2 ? "soon" : "this-week"
      });
    }

    // 8. Stuck in stage — no activity for 7+ days with no event proximity excuse
    if (b.daysWaiting >= 7 && (cd === null || cd > 14) && b.responseUrgency !== "critical" && b.responseUrgency !== "overdue") {
      items.push({
        id: `${b.id}-stuck`,
        buyoutId: b.id,
        buyoutName: b.name,
        label: `${b.name} stalled in "${b.lifecycleStage}" — ${b.daysWaiting}d with no activity`,
        dueLabel: `${b.daysWaiting}d stalled`,
        urgency: b.daysWaiting >= 14 ? "overdue" : "soon"
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
          {/* Auto-open on desktop, collapsed on mobile */}
          {/* eslint-disable-next-line @next/next/no-sync-scripts */}
          <script dangerouslySetInnerHTML={{ __html: `document.addEventListener('DOMContentLoaded',function(){if(window.innerWidth>980){var d=document.querySelector('.todo-collapse');if(d)d.open=true}})` }} />
          <details className="todo-collapse">
            <summary className="todo-collapse-header">
              <span style={{ fontFamily: "Georgia, serif", fontWeight: 700, fontSize: "0.92rem", color: "var(--coffee)" }}>This Week</span>
              {todos.length > 0 && (
                <span style={{ background: "#E8581B", color: "#fff", borderRadius: 999, fontSize: "0.68rem", fontWeight: 700, padding: "2px 7px", lineHeight: 1.4 }}>
                  {todos.length}
                </span>
              )}
              <span className="todo-collapse-arrow" />
            </summary>
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
          </details>

          <section style={{ marginTop: "0.5rem" }}>
            <OperationsDashboard buyouts={buyouts} />
          </section>
        </div>
      </PortalShell>
    </div>
  );
}
