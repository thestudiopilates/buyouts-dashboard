"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { BuyoutSummary } from "@/lib/types";

const COLORS = {
  coffee: "#28200E",
  oat: "#EEE2D9",
  oatLight: "#F7F3EF",
  seaglass: "#006976",
  sky: "#A1B1A4",
  sage: "#797F5D",
  sunshine: "#F2A408",
  apricot: "#E0800E",
  terracotta: "#9F543F",
  cherry: "#E8581B",
  white: "#FFFFFF",
  warmGrey: "#B5AA9F",
  divider: "#E0D6CC",
  terracottaLight: "#F5EBE7",
  card: "#FEFCFA"
} as const;

const TABS = [
  ["overview", "Overview"],
  ["checklist", "Checklist"],
  ["emails", "Emails"],
  ["financials", "Financials"]
] as const;

const GROUPS = ["Intake", "Planning", "Payment", "Logistics", "Pre-Event", "Execution"] as const;

const groupColors: Record<(typeof GROUPS)[number], string> = {
  Intake: COLORS.seaglass,
  Planning: COLORS.sage,
  Payment: COLORS.terracotta,
  Logistics: COLORS.sky,
  "Pre-Event": COLORS.sunshine,
  Execution: COLORS.apricot
};

const EMAIL_TEMPLATES = [
  { id: "t1", label: "First Inquiry Email", requiredFields: ["clientEmail"] },
  { id: "t3", label: "Deposit & Date", requiredFields: ["eventDate", "depositLink"] },
  { id: "t5", label: "Event Details & Sign Up", requiredFields: ["eventDate", "startTime", "endTime", "signupLink"] },
  { id: "t6", label: "Remaining Payment", requiredFields: ["balanceLink"] },
  { id: "t10", label: "Missing Signups", requiredFields: ["signupLink"] },
  { id: "t11", label: "Final Confirmation", requiredFields: ["eventDate", "startTime", "endTime"] }
] as const;

const TEMPLATE_HINTS: Record<string, string> = {
  t1: "Initial intake response",
  t3: "Date confirmation and payment request",
  t5: "Locked event details and signup link",
  t6: "Remaining balance follow-up",
  t10: "Missing attendee signups reminder",
  t11: "Final event details"
};

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0
  }).format(value);
}

function formatDisplayDate(value: string) {
  if (!value || value === "TBD") {
    return "TBD";
  }

  const parsed = new Date(`${value}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "America/New_York"
  }).format(parsed);
}

function eventTypeStyle(type: string) {
  switch (type) {
    case "Birthday":
      return { bg: `${COLORS.sunshine}1A`, fg: COLORS.sunshine };
    case "Corporate":
      return { bg: `${COLORS.seaglass}1A`, fg: COLORS.seaglass };
    case "Bachelorette":
      return { bg: `${COLORS.terracotta}1A`, fg: COLORS.terracotta };
    default:
      return { bg: `${COLORS.sage}1A`, fg: COLORS.sage };
  }
}

function trackingColor(value: BuyoutSummary["trackingHealth"]) {
  if (value === "On track") return COLORS.seaglass;
  if (value === "At risk") return COLORS.apricot;
  if (value === "Major issue") return COLORS.cherry;
  return COLORS.sky;
}

function bicColor(value: BuyoutSummary["ballInCourt"]) {
  if (value === "Client") return COLORS.terracotta;
  if (value === "Both") return COLORS.sage;
  return COLORS.seaglass;
}

function countdownTone(days: number | null) {
  if (days === null || days < 0) return { bg: `${COLORS.warmGrey}22`, fg: COLORS.warmGrey };
  if (days <= 3) return { bg: COLORS.cherry, fg: COLORS.white };
  if (days <= 6) return { bg: COLORS.terracotta, fg: COLORS.white };
  if (days <= 13) return { bg: COLORS.sunshine, fg: COLORS.coffee };
  return { bg: COLORS.seaglass, fg: COLORS.white };
}

function waitingColor(daysWaiting: number) {
  if (daysWaiting > 5) return COLORS.cherry;
  if (daysWaiting > 2) return COLORS.apricot;
  return COLORS.seaglass;
}

function lifecycleSegments(step: number) {
  return Array.from({ length: 12 }, (_, index) => {
    if (index < step) return COLORS.seaglass;
    if (index === Math.min(step, 11)) return COLORS.terracotta;
    return COLORS.divider;
  });
}

function workflowDone(buyout: BuyoutSummary) {
  return buyout.workflow.filter((step) => step.complete).length;
}

function hasField(buyout: BuyoutSummary, field: string) {
  const map: Record<string, boolean> = {
    clientEmail: Boolean(buyout.clientEmail),
    eventDate: buyout.eventDate !== "TBD",
    startTime: Boolean(buyout.startTime),
    endTime: Boolean(buyout.endTime),
    depositLink: Boolean(buyout.depositLink),
    balanceLink: Boolean(buyout.balanceLink),
    signupLink: Boolean(buyout.signupLink)
  };

  return map[field] ?? false;
}

function readiness(buyout: BuyoutSummary, requiredFields: readonly string[]) {
  const filled = requiredFields.filter((field) => hasField(buyout, field)).length;
  return {
    filled,
    total: requiredFields.length,
    ready: filled === requiredFields.length
  };
}

function KPI({
  label,
  value,
  sub,
  accent
}: {
  label: string;
  value: string | number;
  sub: string;
  accent: string;
}) {
  return (
    <div className="ops-kpi-card">
      <div className="ops-kpi-accent" style={{ background: accent }} />
      <div className="ops-kpi-label">{label}</div>
      <div className="ops-kpi-value">{value}</div>
      <div className="ops-kpi-sub">{sub}</div>
    </div>
  );
}

function Drawer({ buyout, onClose }: { buyout: BuyoutSummary; onClose: () => void }) {
  const [tab, setTab] = useState<(typeof TABS)[number][0]>("overview");
  const countdown = countdownTone(buyout.countdownDays);

  return (
    <>
      <div className="ops-drawer-overlay" onClick={onClose} />
      <aside className="ops-drawer">
        <div
          className="ops-drawer-header"
          style={{
            background: `linear-gradient(135deg, ${COLORS.terracotta}, ${COLORS.coffee})`
          }}
        >
          <div className="ops-drawer-header-top">
            <div>
              <div className="ops-drawer-name">{buyout.name}</div>
              <div className="ops-drawer-sub">
                <span
                  className="ops-type-pill"
                  style={{
                    background: "rgba(255,255,255,.15)",
                    color: COLORS.oat
                  }}
                >
                  {buyout.eventType}
                </span>
                <span>{buyout.location}</span>
              </div>
              <div className="ops-drawer-meta">
                Assigned: {buyout.assignedTo} · {buyout.clientEmail || "No email"}
              </div>
            </div>
            <button className="ops-close-btn" onClick={onClose}>
              ×
            </button>
          </div>
          <div className="ops-drawer-pill-row">
            <span className="ops-drawer-pill">
              <span
                className="ops-pill-dot"
                style={{ background: bicColor(buyout.ballInCourt) }}
              />
              {buyout.ballInCourt === "Team" ? "Us" : buyout.ballInCourt}
            </span>
            <span className="ops-drawer-pill">
              <span
                className="ops-pill-dot"
                style={{ background: trackingColor(buyout.trackingHealth) }}
              />
              {buyout.trackingHealth}
            </span>
          </div>
        </div>

        <div className="ops-status-strip">
          <div className="ops-status-meta">
            <div>
              <div className="ops-status-label">Status</div>
              <div className="ops-status-value">{buyout.statusLabel}</div>
              {buyout.sourceStatusLabel && buyout.sourceStatusLabel !== buyout.statusLabel ? (
                <div className="ops-source-note">Monday source: {buyout.sourceStatusLabel}</div>
              ) : null}
            </div>
            <div className="ops-status-right">
              <div className="ops-status-label">Next Action</div>
              <div className="ops-status-next">{buyout.nextAction}</div>
              {buyout.sourceNextAction && buyout.sourceNextAction !== buyout.nextAction ? (
                <div className="ops-source-note">Monday source: {buyout.sourceNextAction}</div>
              ) : null}
            </div>
          </div>
          <div className="ops-lifecycle-bar">
            {lifecycleSegments(buyout.lifecycleStep).map((color, index) => (
              <span key={index} style={{ background: color }} />
            ))}
          </div>
        </div>

        <div className="ops-tab-bar">
          {TABS.map(([key, label]) => (
            <button
              className={`ops-tab-btn${tab === key ? " active" : ""}`}
              key={key}
              onClick={() => setTab(key)}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="ops-drawer-body">
          {tab === "overview" ? (
            <div>
              {buyout.healthFlags.length > 0 ? (
                <div className="ops-alert-box">
                  <div className="ops-alert-title">Source board inconsistencies</div>
                  {buyout.healthFlags.map((flag) => (
                    <div className="ops-alert-line" key={flag}>
                      {flag}
                    </div>
                  ))}
                </div>
              ) : null}

              <div className="ops-quick-grid">
                {[
                  [
                    buyout.countdownDays === null
                      ? "TBD"
                      : buyout.countdownDays < 0
                        ? "Past"
                        : buyout.countdownDays,
                    "Days Out",
                    buyout.countdownDays !== null && buyout.countdownDays >= 0 && buyout.countdownDays <= 7
                  ],
                  [buyout.daysWaiting, "Waiting", buyout.daysWaiting > 5],
                  [`${workflowDone(buyout)}/${buyout.workflow.length}`, "Checklist", false]
                ].map(([value, label, warn]) => (
                  <div
                    className="ops-quick-card"
                    key={label as string}
                    style={{
                      background: warn ? `${COLORS.cherry}0C` : COLORS.oatLight,
                      borderColor: warn ? `${COLORS.cherry}22` : "transparent"
                    }}
                  >
                    <div
                      className="ops-quick-value"
                      style={{ color: warn ? COLORS.cherry : COLORS.coffee }}
                    >
                      {value}
                    </div>
                    <div className="ops-quick-label">{label}</div>
                  </div>
                ))}
              </div>

              <div className="ops-section-label">Source Snapshot</div>
              <div className="ops-quick-grid ops-source-grid">
                {[
                  [
                    buyout.lifecycleStage,
                    buyout.sourceLifecycleStage && buyout.sourceLifecycleStage !== buyout.lifecycleStage
                      ? `Monday: ${buyout.sourceLifecycleStage}`
                      : null,
                    "Lifecycle"
                  ],
                  [
                    buyout.nextAction,
                    buyout.sourceNextAction && buyout.sourceNextAction !== buyout.nextAction
                      ? `Monday: ${buyout.sourceNextAction}`
                      : null,
                    "Due Next"
                  ],
                  [
                    buyout.trackingHealth,
                    buyout.sourceTrackingHealth && buyout.sourceTrackingHealth !== buyout.trackingHealth
                      ? `Monday: ${buyout.sourceTrackingHealth}`
                      : null,
                    "Tracking"
                  ],
                  [
                    buyout.ballInCourt === "Team" ? "Us" : buyout.ballInCourt,
                    buyout.sourceBallInCourt && buyout.sourceBallInCourt !== buyout.ballInCourt
                      ? `Monday: ${buyout.sourceBallInCourt === "Team" ? "Us" : buyout.sourceBallInCourt}`
                      : null,
                    "Ball In Court"
                  ]
                ].map(([value, subvalue, label]) => (
                  <div className="ops-quick-card ops-source-card" key={label as string}>
                    <div className="ops-quick-value ops-source-value">{value}</div>
                    {subvalue ? <div className="ops-source-subvalue">{subvalue}</div> : null}
                    <div className="ops-quick-label">{label}</div>
                  </div>
                ))}
              </div>

              <div className="ops-section-label">Event Details</div>
              <div className="ops-detail-card">
                {[
                  ["Date", buyout.eventDate],
                  ["Preferred", buyout.preferredDates || "Not captured"],
                  ["Time", buyout.startTime && buyout.endTime ? `${buyout.startTime} - ${buyout.endTime}` : "TBD"],
                  ["Location", buyout.location],
                  ["Instructor", buyout.instructor],
                  ["Front Desk", buyout.assignedTo]
                ].map(([label, value]) => (
                  <div className="ops-detail-line" key={label}>
                    <span>{label}</span>
                    <strong>{value}</strong>
                  </div>
                ))}
              </div>

              <div className="ops-section-label">Attendance</div>
              <div className="ops-attendance">
                <div className="ops-attendance-count">
                  <span>{buyout.signups}</span>
                  <small>/ {buyout.capacity || 0}</small>
                </div>
                <div className="ops-mini-progress large">
                  <span style={{ width: `${buyout.signupFillPercent ?? 0}%` }} />
                </div>
              </div>

              <div className="ops-section-label">Contact</div>
              <div className="ops-detail-card">
                <div className="ops-contact-primary">{buyout.clientEmail || "No email captured"}</div>
                {buyout.clientPhone ? <div className="ops-contact-secondary">{buyout.clientPhone}</div> : null}
              </div>

              <div className="ops-section-label">Notes</div>
              <div className="ops-notes-box">
                <pre>{buyout.notes || "No notes yet"}</pre>
              </div>
            </div>
          ) : null}

          {tab === "checklist" ? (
            <div>
              <div className="ops-tab-summary">
                <div>
                  <span className="ops-tab-big">{workflowDone(buyout)}</span>
                  <span className="ops-tab-small">of {buyout.workflow.length} complete</span>
                </div>
                <span className="ops-percent-pill">{buyout.workflowProgress}%</span>
              </div>
              <div className="ops-mini-progress large workflow">
                <span style={{ width: `${buyout.workflowProgress}%` }} />
              </div>
              <div className="ops-group-stack">
                {GROUPS.map((group) => {
                  const items = buyout.workflow.filter((step) => step.group === group);
                  if (items.length === 0) return null;
                  const done = items.filter((step) => step.complete).length;

                  return (
                    <div key={group}>
                      <div className="ops-group-head">
                        <div className="ops-group-title">
                          <span style={{ background: groupColors[group] }} />
                          {group}
                        </div>
                        <div className="ops-group-count">
                          {done}/{items.length}
                        </div>
                      </div>
                      {items.map((step) => (
                        <div className="ops-check-row" key={step.key}>
                          <div
                            className="ops-check-box"
                            style={{
                              borderColor: step.complete ? COLORS.seaglass : COLORS.divider,
                              background: step.complete ? COLORS.seaglass : "transparent"
                            }}
                          >
                            {step.complete ? "✓" : ""}
                          </div>
                          <span>{step.label}</span>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}

          {tab === "emails" ? (
            <div>
              <div className="ops-tab-summary">
                <div>
                  <span className="ops-tab-big">
                    {buyout.sentTemplateIds.length}
                  </span>
                  <span className="ops-tab-small">templates already sent</span>
                </div>
              </div>
              <div className="ops-group-stack">
                {EMAIL_TEMPLATES.map((template) => {
                  const state = readiness(buyout, template.requiredFields);
                  const sent = buyout.sentTemplateIds.includes(template.id);
                  return (
                    <div
                      className="ops-email-row"
                      key={template.id}
                      style={{
                        borderColor: sent
                          ? `${COLORS.seaglass}33`
                          : state.ready
                            ? `${COLORS.sunshine}33`
                            : `${COLORS.cherry}22`
                      }}
                    >
                      <div>
                        <div className="ops-email-title">{template.label}</div>
                        <div className="ops-email-meta">
                          {sent
                            ? TEMPLATE_HINTS[template.id]
                            : state.ready
                              ? "Ready to send once automation is wired"
                            : `Missing ${state.total - state.filled} required field${state.total - state.filled === 1 ? "" : "s"}`}
                        </div>
                      </div>
                      <span
                        className="ops-email-state"
                        style={{
                          color: sent ? COLORS.seaglass : state.ready ? COLORS.apricot : COLORS.cherry
                        }}
                      >
                        {sent ? "Sent" : state.ready ? "Ready" : "Blocked"}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}

          {tab === "financials" ? (
            <div>
              <div className="ops-financial-grid">
                {[
                  ["Total", formatMoney(buyout.total), COLORS.coffee],
                  ["Paid", formatMoney(buyout.amountPaid), COLORS.seaglass],
                  ["Remaining", formatMoney(buyout.outstanding), buyout.outstanding > 0 ? COLORS.cherry : COLORS.seaglass]
                ].map(([label, value, color]) => (
                  <div className="ops-money-card" key={label as string}>
                    <div className="ops-money-label">{label}</div>
                    <div className="ops-money-value" style={{ color }}>
                      {value}
                    </div>
                  </div>
                ))}
              </div>
              <div className="ops-tab-summary">
                <div>
                  <span className="ops-tab-big">{buyout.paymentProgress}%</span>
                  <span className="ops-tab-small">payment progress</span>
                </div>
              </div>
              <div className="ops-mini-progress large">
                <span style={{ width: `${buyout.paymentProgress}%` }} />
              </div>
              <div className="ops-link-stack">
                {[
                  ["Deposit Link", buyout.depositLink],
                  ["Balance Link", buyout.balanceLink],
                  ["Sign-Up Link", buyout.signupLink]
                ].map(([label, url]) => (
                  <a
                    className="ops-link-card"
                    href={url || undefined}
                    key={label as string}
                    rel="noreferrer"
                    target={url ? "_blank" : undefined}
                  >
                    <div className="ops-link-icon" style={{ background: url ? `${COLORS.seaglass}18` : COLORS.divider }} />
                    <div className="ops-link-copy">
                      <div>{label}</div>
                      <small>{url ? "Available for Kelly test flow" : "Not created"}</small>
                    </div>
                  </a>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        <div className="ops-drawer-footer">
          <button className="ops-footer-primary">Send Email</button>
          <button className="ops-footer-secondary">Edit Details</button>
          <button className="ops-footer-tertiary">Notes</button>
        </div>
      </aside>
    </>
  );
}

export function OperationsDashboard({ buyouts }: { buyouts: BuyoutSummary[] }) {
  const [selected, setSelected] = useState<BuyoutSummary | null>(null);
  const [filterBic, setFilterBic] = useState("All");
  const [filterLocation, setFilterLocation] = useState("All");
  const [filterStaff, setFilterStaff] = useState("All");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("eventDate");
  const [showCompleted, setShowCompleted] = useState(false);

  const locations = useMemo(
    () => ["All", ...new Set(buyouts.map((buyout) => buyout.location).filter(Boolean))],
    [buyouts]
  );
  const staff = useMemo(
    () => ["All", ...new Set(buyouts.map((buyout) => buyout.assignedTo).filter(Boolean))],
    [buyouts]
  );

  const visible = useMemo(() => {
    return [...buyouts]
      .filter((buyout) => {
        if (!showCompleted && ["Complete", "Cancelled"].includes(buyout.lifecycleStage)) return false;
        if (filterBic !== "All" && buyout.ballInCourt !== filterBic) return false;
        if (filterLocation !== "All" && buyout.location !== filterLocation) return false;
        if (filterStaff !== "All" && buyout.assignedTo !== filterStaff) return false;
        if (search && !buyout.name.toLowerCase().includes(search.toLowerCase())) return false;
        return true;
      })
      .sort((a, b) => {
        if (sort === "eventDate") {
          if (a.eventDate === "TBD") return 1;
          if (b.eventDate === "TBD") return -1;
          return a.eventDate.localeCompare(b.eventDate);
        }
        if (sort === "daysWaiting") return b.daysWaiting - a.daysWaiting;
        if (sort === "status") return a.lifecycleStep - b.lifecycleStep;
        if (sort === "checklist") return b.workflowProgress - a.workflowProgress;
        return a.name.localeCompare(b.name);
      });
  }, [buyouts, filterBic, filterLocation, filterStaff, search, sort, showCompleted]);

  const active = buyouts.filter((buyout) => !["Complete", "Cancelled"].includes(buyout.lifecycleStage));
  const pipeline = active.reduce((sum, buyout) => sum + buyout.total, 0);
  const collected = active.reduce((sum, buyout) => sum + buyout.amountPaid, 0);
  const attention = active.filter(
    (buyout) => buyout.daysWaiting > 5 || ["At risk", "Major issue"].includes(buyout.trackingHealth)
  ).length;
  const thisWeek = active.filter(
    (buyout) => buyout.countdownDays !== null && buyout.countdownDays >= 0 && buyout.countdownDays <= 7
  ).length;

  return (
    <div className="ops-shell">
      <div className="ops-mode-banner">
        <div>
          <div className="ops-mode-title">Kelly test record</div>
          <div className="ops-mode-copy">
            Live dashboard is intentionally focused on the single test buyout while we finish status
            and workflow alignment.
          </div>
        </div>
        <Link className="ops-mode-link" href="/buyouts/inquire">
          Open intake form
        </Link>
      </div>

      <div className="ops-kpi-grid">
        <KPI
          label="Active Buyouts"
          value={active.length}
          sub={`${active.filter((buyout) => buyout.ballInCourt === "Team").length} on you · ${active.filter((buyout) => buyout.ballInCourt === "Client").length} on client`}
          accent={COLORS.seaglass}
        />
        <KPI
          label="This Week"
          value={thisWeek}
          sub="events in next 7 days"
          accent={thisWeek > 0 ? COLORS.sunshine : COLORS.seaglass}
        />
        <KPI
          label="Needs Attention"
          value={attention}
          sub="overdue or flagged"
          accent={attention > 0 ? COLORS.cherry : COLORS.seaglass}
        />
        <KPI
          label="Pipeline"
          value={formatMoney(pipeline)}
          sub={`${formatMoney(collected)} collected`}
          accent={COLORS.terracotta}
        />
        <KPI
          label="Outstanding"
          value={formatMoney(pipeline - collected)}
          sub="remaining balance"
          accent={pipeline - collected > 0 ? COLORS.apricot : COLORS.seaglass}
        />
      </div>

      <div className="ops-filter-bar">
        <input
          className="ops-search"
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search clients..."
          type="text"
          value={search}
        />
        {["All", "Team", "Client"].map((option) => (
          <button
            className={`ops-filter-pill${filterBic === option ? " active" : ""}`}
            key={option}
            onClick={() => setFilterBic(option)}
            type="button"
          >
            {option === "Team" ? "Us" : option}
          </button>
        ))}
        <div className="ops-filter-divider" />
        <select className="ops-select" onChange={(event) => setFilterLocation(event.target.value)} value={filterLocation}>
          {locations.map((option) => (
            <option key={option} value={option}>
              {option === "All" ? "All Locations" : option}
            </option>
          ))}
        </select>
        <select className="ops-select" onChange={(event) => setFilterStaff(event.target.value)} value={filterStaff}>
          {staff.map((option) => (
            <option key={option} value={option}>
              {option === "All" ? "All Staff" : option}
            </option>
          ))}
        </select>
        <select className="ops-select" onChange={(event) => setSort(event.target.value)} value={sort}>
          <option value="eventDate">Event Date</option>
          <option value="daysWaiting">Days Waiting</option>
          <option value="status">Lifecycle</option>
          <option value="checklist">Checklist %</option>
          <option value="name">Name</option>
        </select>
        <label className="ops-checkbox-row">
          <input checked={showCompleted} onChange={(event) => setShowCompleted(event.target.checked)} type="checkbox" />
          Completed
        </label>
      </div>

      <div className="ops-table-frame">
        <div className="ops-grid-row ops-grid-head">
          {["Client", "Status", "Next Action", "Waiting On", "Countdown", "Sign-Ups", "Progress"].map((label) => (
            <div key={label}>{label}</div>
          ))}
        </div>

        {visible.length === 0 ? (
          <div className="ops-empty">No buyouts match your filters.</div>
        ) : (
          visible.map((buyout) => {
            const typeStyle = eventTypeStyle(buyout.eventType);
            const track = trackingColor(buyout.trackingHealth);
            const wait = waitingColor(buyout.daysWaiting);
            const countdown = countdownTone(buyout.countdownDays);

            return (
              <button
                className={`ops-grid-row ops-row${selected?.id === buyout.id ? " selected" : ""}`}
                key={buyout.id}
                onClick={() => setSelected(buyout)}
                type="button"
              >
                <div className="ops-client-cell">
                  <div
                    className="ops-avatar"
                    style={{ background: `${bicColor(buyout.ballInCourt)}18`, color: bicColor(buyout.ballInCourt) }}
                  >
                    {buyout.name[0]}
                  </div>
                  <div className="ops-client-copy">
                    <div className="ops-client-name">{buyout.name}</div>
                    <div className="ops-client-sub">
                      <span
                        className="ops-type-pill"
                        style={{ background: typeStyle.bg, color: typeStyle.fg }}
                      >
                        {buyout.eventType}
                      </span>
                      <span>{buyout.assignedTo}</span>
                    </div>
                    <div className="ops-client-meta">
                      <span>{formatDisplayDate(buyout.eventDate)}</span>
                      <span>•</span>
                      <span>{buyout.location}</span>
                    </div>
                  </div>
                </div>

                <div>
                  <div className="ops-status-badge" style={{ background: `${track}14`, color: track }}>
                    {buyout.statusLabel}
                  </div>
                  <div className="ops-row-meta">
                    {buyout.lifecycleStage} · {buyout.trackingHealth}
                    {buyout.sourceStatusLabel && buyout.sourceStatusLabel !== buyout.statusLabel
                      ? ` · Monday: ${buyout.sourceStatusLabel}`
                      : ""}
                  </div>
                  <div className="ops-lifecycle-bar table">
                    {lifecycleSegments(buyout.lifecycleStep).map((color, index) => (
                      <span key={index} style={{ background: color }} />
                    ))}
                  </div>
                </div>

                <div className="ops-next-cell">
                  <div className="ops-next-text" style={{ color: wait }}>
                    {buyout.nextAction}
                  </div>
                  <div className="ops-row-meta">
                    {buyout.sourceNextAction && buyout.sourceNextAction !== buyout.nextAction
                      ? `Monday says ${buyout.sourceNextAction}`
                      : buyout.lastAction
                        ? `Last action ${formatDisplayDate(buyout.lastAction)}`
                        : "No action logged"}
                  </div>
                  {buyout.daysWaiting > 0 ? (
                    <span className="ops-wait-pill" style={{ background: `${wait}14`, color: wait }}>
                      {buyout.daysWaiting}d waiting
                    </span>
                  ) : null}
                </div>

                <div>
                  <span
                    className="ops-bic-pill"
                    style={{ background: `${bicColor(buyout.ballInCourt)}14`, color: bicColor(buyout.ballInCourt) }}
                  >
                    <span
                      className="ops-pill-dot"
                      style={{ background: bicColor(buyout.ballInCourt) }}
                    />
                    {buyout.ballInCourt === "Team" ? "Us" : buyout.ballInCourt}
                  </span>
                </div>

                <div className="ops-countdown-wrap">
                  <span className="ops-countdown" style={{ background: countdown.bg, color: countdown.fg }}>
                    {buyout.countdownDays === null
                      ? "TBD"
                      : buyout.countdownDays < 0
                        ? "Past"
                        : buyout.countdownDays}
                  </span>
                </div>

                <div>
                  <div className="ops-cell-stat">
                    {buyout.signups}
                    <small>/{buyout.capacity || 0}</small>
                  </div>
                  <div className="ops-mini-progress">
                    <span style={{ width: `${buyout.signupFillPercent ?? 0}%` }} />
                  </div>
                </div>

                <div>
                  <div className="ops-cell-stat">
                    {buyout.workflowProgress}
                    <small>%</small>
                  </div>
                  <div className="ops-mini-progress workflow">
                    <span style={{ width: `${buyout.workflowProgress}%` }} />
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>

      <div className="ops-footnote">
        {visible.length} of {buyouts.length} buyouts · The Studio Pilates
      </div>

      {selected ? <Drawer buyout={selected} onClose={() => setSelected(null)} /> : null}
    </div>
  );
}
