"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";

import { BuyoutSummary, PaymentRecord } from "@/lib/types";

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
  ["financials", "Payments"],
  ["activity", "Activity"]
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
  { id: "t0", label: "Custom / One-Off Message", requiredFields: ["clientEmail"] },
  { id: "t1", label: "First Inquiry Email", requiredFields: ["clientEmail"] },
  { id: "t2", label: "Food & Beverage Policy", requiredFields: ["clientEmail"] },
  { id: "t3", label: "Payment — Deposit (30+ days)", requiredFields: ["eventDate", "depositLink"], paymentTier: "deposit" as const },
  { id: "t3a", label: "Payment — Standard (14–30 days)", requiredFields: ["eventDate", "depositLink"], paymentTier: "standard" as const },
  { id: "t3b", label: "Payment — Rush (under 14 days)", requiredFields: ["eventDate", "depositLink"], paymentTier: "rush" as const },
  { id: "t4", label: "Deposit Reminder", requiredFields: ["depositLink"] },
  { id: "t5", label: "Event Details & Sign Up", requiredFields: ["eventDate", "startTime", "endTime", "signupLink"] },
  { id: "t6", label: "Remaining Payment", requiredFields: ["balanceLink"] },
  { id: "t7", label: "Balance Reminder", requiredFields: ["balanceLink"] },
  { id: "t8", label: "Cancelled (No Refund)", requiredFields: ["clientEmail"] },
  { id: "t9", label: "Cancelled (Refund)", requiredFields: ["clientEmail"] },
  { id: "t10", label: "Missing Signups", requiredFields: ["signupLink"] },
  { id: "t11", label: "Final Confirmation", requiredFields: ["eventDate", "startTime", "endTime"] },
  { id: "t12", label: "Post-Event Thank You", requiredFields: ["clientEmail"] },
  { id: "t13", label: "Ongoing Discussion", requiredFields: ["clientEmail"] },
  { id: "t14", label: "48-Hour Missing Signups", requiredFields: ["signupLink"] }
] as const;

const TEMPLATE_HINTS: Record<string, string> = {
  t0: "Custom message sent",
  t1: "Initial intake response",
  t2: "Food & beverage policy clarification",
  t3: "Deposit payment — event 30+ days from inquiry",
  t3a: "Standard full payment — event 14–30 days from inquiry",
  t3b: "Rush payment — under 14 days from inquiry",
  t4: "Deposit follow-up reminder",
  t5: "Locked event details and signup link",
  t6: "Remaining balance request",
  t7: "Balance follow-up reminder",
  t8: "Cancellation — no refund",
  t9: "Cancellation — refund issued",
  t10: "Missing attendee signups reminder",
  t11: "Final event details confirmed",
  t12: "Post-event thank you and feedback",
  t13: "General follow-up / discussion",
  t14: "Urgent 48-hour signup reminder"
};

const SINGLE_SEND_TEMPLATE_IDS = new Set(["t1", "t3", "t3a", "t3b", "t5", "t8", "t9", "t11", "t12"]);

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

function formatDateTime(value: string | null) {
  if (!value) {
    return "Unknown";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit"
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

function lifecycleSegments(step: number, stage: string) {
  if (["Complete"].includes(stage)) {
    return Array.from({ length: 12 }, () => COLORS.seaglass);
  }

  if (["Cancelled", "DOA", "Not Possible"].includes(stage)) {
    return Array.from({ length: 12 }, () => COLORS.cherry);
  }

  if (stage === "On Hold") {
    return Array.from({ length: 12 }, (_, index) => index < step ? COLORS.sunshine : COLORS.divider);
  }

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

function Drawer({
  buyout,
  onClose,
  onBuyoutUpdated
}: {
  buyout: BuyoutSummary;
  onClose: () => void;
  onBuyoutUpdated: (buyout: BuyoutSummary) => void;
}) {
  const [tab, setTab] = useState<(typeof TABS)[number][0]>("overview");
  const [editorMode, setEditorMode] = useState<"details" | "notes" | null>(null);
  const [message, setMessage] = useState("");
  const [emailMessage, setEmailMessage] = useState("");
  const [pendingEmailId, setPendingEmailId] = useState("");
  const [draftTemplate, setDraftTemplate] = useState<string | null>(null);
  const [draftSubject, setDraftSubject] = useState("");
  const [draftBody, setDraftBody] = useState("");
  const [draftRawBody, setDraftRawBody] = useState("");
  const [draftCc, setDraftCc] = useState("");
  const [draftLoading, setDraftLoading] = useState(false);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [activityLog, setActivityLog] = useState<Array<{ id: string; createdAt: string; eventType: string; summary: string }>>([]);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [paymentsLoaded, setPaymentsLoaded] = useState(false);
  const [notesList, setNotesList] = useState<Array<{ id: string; createdAt: string; text: string; author: string }>>([]);
  const [newNoteText, setNewNoteText] = useState("");
  const [activityLoaded, setActivityLoaded] = useState(false);
  const [emailSubTab, setEmailSubTab] = useState<"templates" | "sent" | "received">("templates");
  const [emailHistory, setEmailHistory] = useState<Array<{ id: string; date: string; from: string; to: string; subject: string; snippet: string; direction: string }>>([]);
  const [emailHistoryLoaded, setEmailHistoryLoaded] = useState(false);
  const [unrespondedHours, setUnrespondedHours] = useState<number | null>(null);
  const [form, setForm] = useState({
    clientName: buyout.clientName,
    clientEmail: buyout.clientEmail,
    clientPhone: buyout.clientPhone ?? "",
    eventType: buyout.eventType,
    eventDate: buyout.eventDate === "TBD" ? "" : buyout.eventDate,
    startTime: buyout.startTime ?? "",
    endTime: buyout.endTime ?? "",
    location: buyout.location,
    assignedTo: buyout.assignedTo,
    instructor: buyout.instructor,
    notes: buyout.notes,
    depositLink: buyout.depositLink ?? "",
    balanceLink: buyout.balanceLink ?? "",
    signupLink: buyout.signupLink ?? ""
  });
  const [isPending, startTransition] = useTransition();
  const countdown = countdownTone(buyout.countdownDays);

  function syncFreshBuyout() {
    fetch(`/api/buyouts/${buyout.id}`, { cache: "no-store" })
      .then((response) => response.json())
      .then((payload: { buyout?: BuyoutSummary }) => {
        if (payload.buyout) {
          onBuyoutUpdated(payload.buyout);
        }
      })
      .catch(() => {});
  }

  useEffect(() => {
    setTab("overview");
    setEditorMode(null);
    setMessage("");
    setEmailMessage("");
    setPendingEmailId("");
    setDraftTemplate(null);
    setDraftSubject("");
    setDraftBody("");
    setDraftRawBody("");
    setDraftCc("");
    setDraftLoading(false);
    setPreviewHtml(null);
    setActivityLog([]);
    setPayments([]);
    setPaymentsLoaded(false);
    setNotesList([]);
    setNewNoteText("");
    setActivityLoaded(false);
    setEmailSubTab("templates");
    setEmailHistory([]);
    setEmailHistoryLoaded(false);
    setUnrespondedHours(null);
  }, [buyout.id]);

  useEffect(() => {
    setForm({
      clientName: buyout.clientName,
      clientEmail: buyout.clientEmail,
      clientPhone: buyout.clientPhone ?? "",
      eventType: buyout.eventType,
      eventDate: buyout.eventDate === "TBD" ? "" : buyout.eventDate,
      startTime: buyout.startTime ?? "",
      endTime: buyout.endTime ?? "",
      location: buyout.location,
      assignedTo: buyout.assignedTo,
      instructor: buyout.instructor,
      notes: buyout.notes,
      depositLink: buyout.depositLink ?? "",
      balanceLink: buyout.balanceLink ?? "",
      signupLink: buyout.signupLink ?? ""
    });
  }, [buyout]);

  useEffect(() => {
    syncFreshBuyout();
  }, [buyout.id]);

  function updateField(key: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function handleSave() {
    setMessage("");

    startTransition(async () => {
      const response = await fetch(`/api/buyouts/${buyout.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form)
      });

      const payload = (await response.json()) as {
        message?: string;
        buyout?: BuyoutSummary;
      };

      if (!response.ok || !payload.buyout) {
        setMessage(payload.message ?? "Unable to update this buyout right now.");
        return;
      }

      onBuyoutUpdated(payload.buyout);
      setMessage(payload.message ?? "Buyout updated.");
      setEditorMode(null);
    });
  }

  function stripTagsForEdit(raw: string) {
    return raw
      .replace(/<hr\s*\/?>\s*<b>([^<]+)<\/b>/gi, "———  $1")
      .replace(/<hr\s*\/?>/gi, "———")
      .replace(/<b>/gi, "")
      .replace(/<\/b>/gi, "");
  }

  function restoreTagsForSend(clean: string) {
    return clean
      .replace(/———\s{2}(.+)/g, "<hr> <b>$1</b>")
      .replace(/———/g, "<hr>");
  }

  function handleOpenDraft(templateId: string) {
    setEmailMessage("");
    setPreviewHtml(null);
    setDraftTemplate(templateId);
    setDraftLoading(true);
    setDraftCc("");

    fetch(`/api/email-templates/${templateId}?buyoutId=${encodeURIComponent(buyout.id)}`)
      .then((res) => {
        if (!res.ok) throw new Error(`API returned ${res.status}`);
        return res.json();
      })
      .then((data: { template?: { subjectTemplate?: string; bodyTemplate?: string }; preview?: { renderedSubject?: string; renderedBody?: string } }) => {
        const subject = data.preview?.renderedSubject || data.template?.subjectTemplate || "";
        const body = data.preview?.renderedBody || data.template?.bodyTemplate || "";
        setDraftSubject(subject);
        setDraftRawBody(body);
        setDraftBody(stripTagsForEdit(body));
        setDraftLoading(false);
      })
      .catch((err) => {
        console.error("Draft load failed:", err);
        setEmailMessage(`Unable to load template: ${err instanceof Error ? err.message : "unknown error"}`);
        setDraftTemplate(null);
        setDraftLoading(false);
      });
  }

  function loadEmailHistory(force?: boolean) {
    if (emailHistoryLoaded && !force) return;
    setEmailHistoryLoaded(true);

    fetch(`/api/buyouts/${buyout.id}/email-history`)
      .then((r) => r.json())
      .then((data: { all?: typeof emailHistory }) => {
        const all = data.all ?? [];
        setEmailHistory(all);

        const sorted = [...all].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        const lastReceived = sorted.find((m) => m.direction === "received");
        const lastSent = sorted.find((m) => m.direction === "sent");

        if (lastReceived) {
          const receivedTime = new Date(lastReceived.date).getTime();
          const sentAfter = lastSent && new Date(lastSent.date).getTime() > receivedTime;

          if (!sentAfter) {
            const hoursAgo = Math.floor((Date.now() - receivedTime) / 3600000);
            setUnrespondedHours(hoursAgo);
          } else {
            setUnrespondedHours(null);
          }
        } else {
          setUnrespondedHours(null);
        }
      })
      .catch(() => {});
  }

  function loadActivity() {
    fetch(`/api/buyouts/${buyout.id}/activity`)
      .then((r) => r.json())
      .then((data: { activity?: typeof activityLog }) => {
        setActivityLog(data.activity ?? []);
      })
      .catch(() => {});

    fetch(`/api/buyouts/${buyout.id}/notes`)
      .then((r) => r.json())
      .then((data: { notes?: typeof notesList }) => {
        setNotesList(data.notes ?? []);
      })
      .catch(() => {});
  }

  function loadPayments(force?: boolean) {
    if (paymentsLoaded && !force) return;
    setPaymentsLoaded(true);

    fetch(`/api/buyouts/${buyout.id}/payments`)
      .then((r) => r.json())
      .then((data: { payments?: PaymentRecord[] }) => {
        setPayments(data.payments ?? []);
        syncFreshBuyout();
      })
      .catch(() => {});
  }

  function handleAddNote() {
    if (!newNoteText.trim()) return;

    startTransition(async () => {
      const response = await fetch(`/api/buyouts/${buyout.id}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: newNoteText, author: "Team" })
      });

      const payload = (await response.json()) as {
        notes?: Array<{ id: string; createdAt: string; text: string; author: string }>;
        buyout?: BuyoutSummary;
      };

      if (payload.notes) setNotesList(payload.notes);
      if (payload.buyout) onBuyoutUpdated(payload.buyout);
      setNewNoteText("");
      setActivityLoaded(false);
    });
  }

  function handleMarkSent(templateId: string, currentlySent: boolean) {
    startTransition(async () => {
      const response = await fetch(`/api/buyouts/${buyout.id}/mark-sent`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateKey: templateId, unmark: currentlySent })
      });

      const payload = (await response.json()) as { buyout?: BuyoutSummary; error?: string };

      if (payload.buyout) {
        onBuyoutUpdated(payload.buyout);
        setEmailMessage(currentlySent ? `${templateId} unmarked.` : `${templateId} marked as sent offline.`);
      }
    });
  }

  function handleStageChange(newStage: string) {
    if (!newStage) return;
    setMessage("");

    startTransition(async () => {
      const response = await fetch(`/api/buyouts/${buyout.id}/stage`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage: newStage })
      });

      const payload = (await response.json()) as { buyout?: BuyoutSummary; error?: string };

      if (!response.ok || !payload.buyout) {
        setMessage(payload.error ?? "Unable to update stage.");
        return;
      }

      onBuyoutUpdated(payload.buyout);
      setMessage(`Stage updated to ${newStage}.`);
    });
  }

  function handleToggleStep(stepKey: string, currentlyComplete: boolean) {
    startTransition(async () => {
      const response = await fetch(`/api/buyouts/${buyout.id}/workflow`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stepKey, isComplete: !currentlyComplete })
      });

      const payload = (await response.json()) as { buyout?: BuyoutSummary; error?: string };

      if (!response.ok || !payload.buyout) {
        setMessage(payload.error ?? "Unable to update checklist.");
        return;
      }

      onBuyoutUpdated(payload.buyout);
    });
  }

  function handleCloseDraft() {
    setDraftTemplate(null);
    setDraftSubject("");
    setDraftBody("");
    setDraftRawBody("");
    setDraftCc("");
    setPreviewHtml(null);
  }

  function handlePreviewDraft() {
    if (!draftTemplate) return;
    setDraftLoading(true);
    const sendBody = restoreTagsForSend(draftBody);

    fetch(`/api/email-templates/${draftTemplate}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        subject: draftSubject,
        body: sendBody,
        previewLabel: EMAIL_TEMPLATES.find((t) => t.id === draftTemplate)?.label
      })
    })
      .then((res) => res.json())
      .then((data: { html?: string }) => {
        setPreviewHtml(data.html ?? null);
        setDraftLoading(false);
      })
      .catch(() => {
        setEmailMessage("Unable to render preview.");
        setDraftLoading(false);
      });
  }

  function handleConfirmSend() {
    if (!draftTemplate) return;
    setEmailMessage("");
    setPendingEmailId(draftTemplate);
    const sendBody = restoreTagsForSend(draftBody);

    startTransition(async () => {
      const response = await fetch(`/api/email-templates/${draftTemplate}/test-send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          buyoutId: buyout.id,
          bodyOverride: sendBody,
          cc: draftCc || undefined
        })
      });

      const payload = (await response.json()) as {
        error?: string;
        message?: string;
        buyout?: BuyoutSummary;
      };

      if (!response.ok || !payload.buyout) {
        setEmailMessage(payload.error ?? "Unable to run the internal review send.");
        setPendingEmailId("");
        return;
      }

      onBuyoutUpdated(payload.buyout);
      setEmailMessage(payload.message ?? "Internal review send completed.");
      setPendingEmailId("");
      handleCloseDraft();
    });
  }

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
              <select
                className="ops-stage-select"
                disabled={isPending}
                onChange={(e) => handleStageChange(e.target.value)}
                value=""
              >
                <option value="">Change status...</option>
                <optgroup label="Advance">
                  {["Inquiry", "Respond", "Discuss", "Feasible", "Quote", "Deposit", "Paid", "Sign-Ups", "Confirmed", "Final", "Ready", "Complete"]
                    .filter((s) => s !== buyout.lifecycleStage)
                    .map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                </optgroup>
                <optgroup label="Terminal">
                  <option value="On Hold">Put On Hold</option>
                  <option value="DOA">DOA (No Response)</option>
                  <option value="Not Possible">Not Possible</option>
                  <option value="Cancelled">Cancelled</option>
                </optgroup>
              </select>
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
            {lifecycleSegments(buyout.lifecycleStep, buyout.lifecycleStage).map((color, index) => (
              <span key={index} style={{ background: color }} />
            ))}
          </div>
        </div>

        <div className="ops-tab-bar">
          {TABS.map(([key, label]) => (
            <button
              className={`ops-tab-btn${tab === key ? " active" : ""}`}
              key={key}
              onClick={() => {
                setTab(key);
                if (key === "activity" && !activityLoaded) {
                  setActivityLoaded(true);
                  loadActivity();
                }
                if (key === "financials" && !paymentsLoaded) {
                  loadPayments();
                }
              }}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="ops-drawer-body">
          {tab === "overview" ? (
            <div>
              {editorMode ? (
                <div className="ops-inline-editor">
                  <div className="ops-inline-editor-head">
                    <div className="ops-section-label">
                      {editorMode === "notes" ? "Edit Notes" : "Edit Event Details"}
                    </div>
                    <button className="ops-inline-editor-close" onClick={() => setEditorMode(null)} type="button">
                      Close
                    </button>
                  </div>
                  <div className="ops-inline-editor-grid">
                    {editorMode === "details" ? (
                      <>
                        <label className="field">
                          <span>Client name</span>
                          <input className="input" value={form.clientName} onChange={(event) => updateField("clientName", event.target.value)} />
                        </label>
                        <label className="field">
                          <span>Client email</span>
                          <input className="input" value={form.clientEmail} onChange={(event) => updateField("clientEmail", event.target.value)} />
                        </label>
                        <label className="field">
                          <span>Phone</span>
                          <input className="input" value={form.clientPhone} onChange={(event) => updateField("clientPhone", event.target.value)} />
                        </label>
                        <label className="field">
                          <span>Event type</span>
                          <select className="select" value={form.eventType} onChange={(event) => updateField("eventType", event.target.value)}>
                            <option value="">Select type</option>
                            <option value="Birthday">Birthday</option>
                            <option value="Bachelorette">Bachelorette</option>
                            <option value="Corporate">Corporate</option>
                            <option value="Team Building">Team Building</option>
                            <option value="Specialty Group">Specialty Group</option>
                            <option value="Other">Other</option>
                          </select>
                        </label>
                        <label className="field">
                          <span>Event date</span>
                          <input className="input" type="date" value={form.eventDate} onChange={(event) => updateField("eventDate", event.target.value)} />
                        </label>
                        <label className="field">
                          <span>Location</span>
                          <input className="input" value={form.location} onChange={(event) => updateField("location", event.target.value)} />
                        </label>
                        <label className="field">
                          <span>Start time</span>
                          <input className="input" value={form.startTime} onChange={(event) => updateField("startTime", event.target.value)} />
                        </label>
                        <label className="field">
                          <span>End time</span>
                          <input className="input" value={form.endTime} onChange={(event) => updateField("endTime", event.target.value)} />
                        </label>
                        <label className="field">
                          <span>Assigned staff</span>
                          <input className="input" value={form.assignedTo} onChange={(event) => updateField("assignedTo", event.target.value)} />
                        </label>
                        <label className="field">
                          <span>Instructor</span>
                          <input className="input" value={form.instructor} onChange={(event) => updateField("instructor", event.target.value)} />
                        </label>
                        <div className="field-full" style={{ opacity: 0.7 }}>
                          <span style={{ fontSize: "0.82rem", color: COLORS.warmGrey }}>Next action (auto-derived from checklist)</span>
                          <div className="ops-draft-subject-display">{buyout.nextAction}</div>
                        </div>
                        <label className="field-full">
                          <span>Deposit link</span>
                          <input className="input" value={form.depositLink} onChange={(event) => updateField("depositLink", event.target.value)} />
                        </label>
                        <label className="field-full">
                          <span>Balance link</span>
                          <input className="input" value={form.balanceLink} onChange={(event) => updateField("balanceLink", event.target.value)} />
                        </label>
                        <label className="field-full">
                          <span>Sign-up link</span>
                          <input className="input" value={form.signupLink} onChange={(event) => updateField("signupLink", event.target.value)} />
                        </label>
                      </>
                    ) : (
                      <label className="field-full">
                        <span>Team notes</span>
                        <textarea className="textarea ops-inline-notes" value={form.notes} onChange={(event) => updateField("notes", event.target.value)} />
                      </label>
                    )}
                  </div>
                  <div className="ops-inline-editor-actions">
                    <button className="ops-footer-primary" disabled={isPending} onClick={handleSave} type="button">
                      {isPending ? "Saving..." : "Save Changes"}
                    </button>
                    {message ? <span className="success-text">{message}</span> : null}
                  </div>
                </div>
              ) : null}

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
                  ["Inquiry Date", buyout.inquiryDate ?? "Unknown"],
                  ["Event Date", buyout.eventDate],
                  ["Preferred", buyout.preferredDates || "Not captured"],
                  ["Time", buyout.startTime && buyout.endTime ? `${buyout.startTime} - ${buyout.endTime}` : "TBD"],
                  ["Location", buyout.location],
                  ["Instructor", buyout.instructor],
                  ["Front Desk", buyout.assignedTo],
                  ["Payment Type", buyout.paymentTier === "rush" ? `Rush (+$${buyout.rushFee} fee)` : buyout.paymentTier === "deposit" ? "Deposit Required ($250 + Balance)" : "Standard (Full Payment)"]
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

          {tab === "checklist" ? (() => {
            const stepDone = (key: string) => buyout.workflow.some((s) => s.key === key && s.complete);
            const balanceDueDate = buyout.eventDate && buyout.eventDate !== "TBD"
              ? formatDisplayDate((() => { const d = new Date(buyout.eventDate + "T12:00:00"); d.setDate(d.getDate() - 14); return d.toISOString().slice(0, 10); })())
              : "14 days before event";

            type ChecklistRow = {
              phase: string;
              color: string;
              client: { key: string; label: string; dueLabel?: string } | null;
              operator: { key: string; label: string; blocked?: string; dueLabel?: string } | null;
            };

            const eventDateObj = buyout.eventDate && buyout.eventDate !== "TBD" ? new Date(buyout.eventDate + "T12:00:00") : null;
            const inquiryDateObj = buyout.inquiryDate ? new Date(buyout.inquiryDate + "T12:00:00") : null;

            function daysBeforeEvent(days: number) {
              if (!eventDateObj) return undefined;
              const d = new Date(eventDateObj); d.setDate(d.getDate() - days);
              return formatDisplayDate(d.toISOString().slice(0, 10));
            }
            function isDuePast(days: number) {
              if (!eventDateObj) return false;
              const d = new Date(eventDateObj); d.setDate(d.getDate() - days);
              return new Date() > d;
            }
            function targetDate(percentOfTimeline: number) {
              if (!inquiryDateObj || !eventDateObj) return undefined;
              const totalMs = eventDateObj.getTime() - inquiryDateObj.getTime();
              if (totalMs <= 0) return undefined;
              const targetMs = inquiryDateObj.getTime() + (totalMs * percentOfTimeline);
              return formatDisplayDate(new Date(targetMs).toISOString().slice(0, 10));
            }
            function isTargetPast(percentOfTimeline: number) {
              if (!inquiryDateObj || !eventDateObj) return false;
              const totalMs = eventDateObj.getTime() - inquiryDateObj.getTime();
              if (totalMs <= 0) return false;
              const targetMs = inquiryDateObj.getTime() + (totalMs * percentOfTimeline);
              return Date.now() > targetMs;
            }
            function dueLine(pct: number, key: string, hardDaysBefore?: number) {
              if (hardDaysBefore !== undefined) {
                const label = daysBeforeEvent(hardDaysBefore);
                const overdue = isDuePast(hardDaysBefore) && !stepDone(key);
                return overdue ? "OVERDUE" : label ? `Due by ${label}` : undefined;
              }
              const label = targetDate(pct);
              const overdue = isTargetPast(pct) && !stepDone(key);
              return overdue ? "OVERDUE" : label ? `Target: ${label}` : undefined;
            }

            const LIFECYCLE_ROWS: ChecklistRow[] = [
              // ── Intake (0-5% of timeline)
              { phase: "Intake", color: COLORS.seaglass, client: { key: "inquiry-reviewed", label: "Client request received" }, operator: { key: "inquiry-reviewed", label: "Review inquiry", dueLabel: dueLine(0.02, "inquiry-reviewed") } },
              { phase: "Intake", color: COLORS.seaglass, client: null, operator: { key: "initial-inquiry-response-sent", label: "Send initial response (t1)", dueLabel: dueLine(0.05, "initial-inquiry-response-sent") } },

              // ── Discussion (5-20% of timeline)
              { phase: "Discussion", color: COLORS.sage, client: { key: "customer-responded", label: "Client responds", dueLabel: dueLine(0.15, "customer-responded") }, operator: { key: "customer-responded", label: "Date / time discussion" } },
              { phase: "Discussion", color: COLORS.sage, client: { key: "date-finalized", label: "Client agrees to proposed date & time", dueLabel: dueLine(0.20, "date-finalized") }, operator: null },
              { phase: "Discussion", color: COLORS.sage, client: null, operator: {
                key: "date-finalized",
                label: "Update event details (date, time, location)",
                blocked: (!buyout.eventDate || buyout.eventDate === "TBD") ? "Event date must be set in Edit Details" : undefined,
                dueLabel: dueLine(0.22, "date-finalized")
              } },

              // ── Payment (20-35% of timeline)
              { phase: "Payment", color: COLORS.terracotta, client: null, operator: {
                key: "deposit-link-sent-and-terms-shared",
                label: buyout.paymentTier === "deposit" ? "Send deposit & terms email (t3)" : buyout.paymentTier === "rush" ? "Send rush payment email (t3b)" : "Send payment email (t3a)",
                dueLabel: dueLine(0.25, "deposit-link-sent-and-terms-shared")
              } },
              ...(buyout.paymentTier === "deposit" ? [
                { phase: "Payment", color: COLORS.terracotta, client: { key: "deposit-paid-and-terms-signed", label: "Client pays $250 deposit", dueLabel: dueLine(0.35, "deposit-paid-and-terms-signed") }, operator: { key: "deposit-paid-and-terms-signed", label: "Confirm deposit received" } }
              ] : [
                { phase: "Payment", color: COLORS.terracotta, client: { key: "deposit-paid-and-terms-signed", label: buyout.paymentTier === "rush" ? "Client pays full amount + $100 rush fee" : "Client pays full amount", dueLabel: buyout.paymentTier === "rush" ? dueLine(0.15, "deposit-paid-and-terms-signed") : dueLine(0.35, "deposit-paid-and-terms-signed") }, operator: { key: "deposit-paid-and-terms-signed", label: "Confirm payment received" } }
              ] as ChecklistRow[]),

              // ── Event Setup (35-55% of timeline)
              { phase: "Event Setup", color: COLORS.sky, client: null, operator: {
                key: "instructor-finalized",
                label: "Finalize instructor & update event details",
                blocked: !buyout.instructor || buyout.instructor === "Unassigned" ? "Instructor must be assigned in Edit Details" : undefined,
                dueLabel: dueLine(0.40, "instructor-finalized")
              } },
              { phase: "Event Setup", color: COLORS.sky, client: null, operator: {
                key: "momence-class-created",
                label: "Create Momence event & update with URL",
                blocked: !buyout.signupLink ? "Signup link must be added in Edit Details" : undefined,
                dueLabel: dueLine(0.48, "momence-class-created")
              } },
              { phase: "Event Setup", color: COLORS.sky, client: null, operator: { key: "momence-link-sign-up-sent", label: "Send event details to client (t5)", dueLabel: dueLine(0.55, "momence-link-sign-up-sent") } },

              // ── Logistics (after event details sent)
              { phase: "Logistics", color: COLORS.sky, client: null, operator: { key: "front-desk-assigned", label: "Confirm front desk staff", dueLabel: dueLine(0.60, "front-desk-assigned") } },
              { phase: "Logistics", color: COLORS.sky, client: null, operator: { key: "front-desk-shift-extended", label: "Extend desk shift if needed", dueLabel: dueLine(0.65, "front-desk-shift-extended") } },

              // ── Registration (hard deadline: 48 hours before event)
              { phase: "Registration", color: COLORS.sunshine, client: {
                key: "all-attendees-registered",
                label: "All guests registered",
                dueLabel: dueLine(0, "all-attendees-registered", 2)
              }, operator: {
                key: "all-attendees-registered",
                label: "Confirm registrations or send reminder (t10)",
                dueLabel: dueLine(0, "all-attendees-registered", 2)
              } },
              { phase: "Registration", color: COLORS.sunshine, client: null, operator: {
                key: "all-waivers-signed",
                label: "Confirm all waivers signed",
                dueLabel: dueLine(0, "all-waivers-signed", 2)
              } },

              // ── Final Confirmations
              { phase: "Final Confirmations", color: COLORS.apricot, client: null, operator: { key: "all-waivers-signed", label: "Confirm again with instructor", dueLabel: dueLine(0.80, "all-waivers-signed") } },
              { phase: "Final Confirmations", color: COLORS.apricot, client: null, operator: { key: "front-desk-assigned", label: "Confirm again with front desk staff", dueLabel: dueLine(0.82, "front-desk-assigned") } },
              { phase: "Final Confirmations", color: COLORS.apricot, client: null, operator: { key: "front-desk-shift-extended", label: "Confirm Connect Team shift extended", dueLabel: dueLine(0.84, "front-desk-shift-extended") } },

              // ── Balance Reminder (deposit tier only — after confirmations)
              ...(buyout.paymentTier === "deposit" ? [
                { phase: "Final Confirmations", color: COLORS.terracotta, client: { key: "remaining-payment-received", label: `Remaining balance due (${balanceDueDate})` }, operator: { key: "remaining-payment-received", label: "Send balance due reminder (t6/t7)", dueLabel: dueLine(0, "remaining-payment-received", 14) } }
              ] : [] as ChecklistRow[]),

              // ── Pre-Event (hard deadlines: 24hrs and day-of)
              { phase: "Pre-Event", color: COLORS.apricot, client: null, operator: {
                key: "final-confirmation-emails-sent",
                label: "Send final confirmation (t11)",
                dueLabel: dueLine(0, "final-confirmation-emails-sent", 1)
              } },
              { phase: "Pre-Event", color: COLORS.apricot, client: null, operator: {
                key: "final-confirmation-emails-sent",
                label: "Send day-of confirmation (same details)",
                dueLabel: eventDateObj ? `Due ${formatDisplayDate(buyout.eventDate)}` : "Due day of event"
              } },

              // ── Execution
              { phase: "Execution", color: COLORS.cherry, client: null, operator: { key: "event-completed", label: "Event delivered & follow-up (t12)", dueLabel: eventDateObj ? formatDisplayDate(buyout.eventDate) : undefined } }
            ];

            let currentPhase = "";

            return (
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

                <div className="ops-dual-header">
                  <div className="ops-dual-col-label">Client</div>
                  <div className="ops-dual-col-label">Operator</div>
                </div>

                <div className="ops-dual-list">
                  {LIFECYCLE_ROWS.map((row, idx) => {
                    const showPhase = row.phase !== currentPhase;
                    if (showPhase) currentPhase = row.phase;

                    return (
                      <div key={idx}>
                        {showPhase ? (
                          <div className="ops-dual-phase" style={{ borderColor: row.color }}>
                            <span style={{ background: row.color }} />
                            {row.phase}
                          </div>
                        ) : null}
                        <div className="ops-dual-row">
                          <div className="ops-dual-cell">
                            {row.client ? (
                              <button
                                className="ops-check-row"
                                onClick={() => handleToggleStep(row.client!.key, stepDone(row.client!.key))}
                                disabled={isPending}
                                type="button"
                              >
                                <div
                                  className="ops-check-box"
                                  style={{
                                    borderColor: stepDone(row.client.key) ? COLORS.terracotta : COLORS.divider,
                                    background: stepDone(row.client.key) ? COLORS.terracotta : "transparent"
                                  }}
                                >
                                  {stepDone(row.client.key) ? "✓" : ""}
                                </div>
                                <div>
                                  <span>{row.client.label}</span>
                                  {row.client.dueLabel ? <div className={`ops-due-label${row.client.dueLabel === "OVERDUE" ? " overdue" : ""}`}>{row.client.dueLabel}</div> : null}
                                </div>
                              </button>
                            ) : <div className="ops-dual-empty" />}
                          </div>
                          <div className="ops-dual-cell">
                            {row.operator ? (() => {
                              const done = stepDone(row.operator!.key);
                              const isBlocked = !done && row.operator!.blocked;
                              return (
                                <button
                                  className={`ops-check-row${isBlocked ? " blocked" : ""}`}
                                  onClick={() => {
                                    if (isBlocked) { setMessage(row.operator!.blocked!); return; }
                                    handleToggleStep(row.operator!.key, done);
                                  }}
                                  disabled={isPending}
                                  type="button"
                                  title={isBlocked ? row.operator!.blocked : undefined}
                                >
                                  <div
                                    className="ops-check-box"
                                    style={{
                                      borderColor: done ? COLORS.seaglass : isBlocked ? COLORS.cherry : COLORS.divider,
                                      background: done ? COLORS.seaglass : "transparent"
                                    }}
                                  >
                                    {done ? "✓" : isBlocked ? "!" : ""}
                                  </div>
                                  <div style={{ opacity: isBlocked ? 0.5 : 1 }}>
                                    <span>{row.operator!.label}</span>
                                    {row.operator!.dueLabel ? <div className={`ops-due-label${row.operator!.dueLabel === "OVERDUE" ? " overdue" : ""}`}>{row.operator!.dueLabel}</div> : null}
                                  </div>
                                </button>
                              );
                            })() : <div className="ops-dual-empty" />}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })() : null}

          {tab === "emails" ? (
            <div>
              {emailMessage ? <div className="ops-email-banner">{emailMessage}</div> : null}

              {!draftTemplate && !previewHtml ? (
                <>
                  <div className="ops-email-subtabs">
                    {(["templates", "sent", "received"] as const).map((st) => {
                      const count = st === "templates" ? 0 : emailHistory.filter((m) => m.direction === st).length;
                      return (
                        <button
                          className={`ops-email-subtab${emailSubTab === st ? " active" : ""}`}
                          key={st}
                          onClick={() => { setEmailSubTab(st); if (st !== "templates") loadEmailHistory(); }}
                          type="button"
                        >
                          {st === "templates" ? "Send" : st === "sent" ? "Sent" : "Received"}
                          {count > 0 ? <span className="ops-subtab-count">{count}</span> : null}
                        </button>
                      );
                    })}
                  </div>
                  {unrespondedHours !== null && unrespondedHours >= 0 ? (
                    <div className={`ops-unresponded-alert${unrespondedHours >= 24 ? " overdue" : ""}`}>
                      <div className="ops-unresponded-icon">{unrespondedHours >= 24 ? "!" : "●"}</div>
                      <div>
                        <div className="ops-unresponded-title">
                          {unrespondedHours >= 24 ? "Response overdue" : "New message from client"}
                        </div>
                        <div className="ops-unresponded-detail">
                          {unrespondedHours === 0
                            ? "Received less than an hour ago"
                            : `Received ${unrespondedHours} hour${unrespondedHours === 1 ? "" : "s"} ago — no response sent`}
                        </div>
                      </div>
                    </div>
                  ) : null}
                </>
              ) : null}

              {previewHtml ? (
                <div className="ops-draft-editor">
                  <div className="ops-draft-header">
                    <span className="ops-draft-title">Final Preview</span>
                    <button className="ops-draft-close" onClick={() => setPreviewHtml(null)} type="button">Back to Editor</button>
                  </div>
                  <div className="ops-preview-frame" dangerouslySetInnerHTML={{ __html: previewHtml }} />
                </div>
              ) : draftTemplate ? (
                <div className="ops-draft-editor">
                  <div className="ops-draft-header">
                    <span className="ops-draft-title">
                      {EMAIL_TEMPLATES.find((t) => t.id === draftTemplate)?.label ?? "Email Draft"}
                    </span>
                    <button className="ops-draft-close" onClick={handleCloseDraft} type="button">Cancel</button>
                  </div>
                  {draftLoading ? (
                    <div className="ops-draft-loading">Loading template...</div>
                  ) : (
                    <>
                      <label className="ops-draft-label">Subject (locked for threading)</label>
                      <div className="ops-draft-subject-display">{draftSubject}</div>
                      <label className="ops-draft-label">CC (optional)</label>
                      <input
                        className="ops-draft-input"
                        onChange={(e) => setDraftCc(e.target.value)}
                        placeholder="additional@email.com, another@email.com"
                        value={draftCc}
                      />
                      <label className="ops-draft-label">Body</label>
                      <textarea
                        className="ops-draft-textarea"
                        onChange={(e) => setDraftBody(e.target.value)}
                        rows={16}
                        value={draftBody}
                      />
                    </>
                  )}
                </div>
              ) : emailSubTab === "templates" ? (
                <>
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
                      const singleSend = SINGLE_SEND_TEMPLATE_IDS.has(template.id);
                      const blocked = !state.ready || (singleSend && sent);
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
                          {template.id !== "t0" ? (
                            <button
                              className={`ops-mark-sent-check${sent ? " checked" : ""}`}
                              disabled={isPending}
                              onClick={(e) => { e.stopPropagation(); handleMarkSent(template.id, sent); }}
                              title={sent ? "Unmark as sent" : "Mark as sent (offline)"}
                              type="button"
                            >
                              {sent ? "✓" : ""}
                            </button>
                          ) : null}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div className="ops-email-title">
                              {template.label}
                              {"paymentTier" in template && template.paymentTier === buyout.paymentTier ? (
                                <span className="ops-recommended-badge">Recommended</span>
                              ) : null}
                            </div>
                            <div className="ops-email-meta">
                              {sent
                                ? TEMPLATE_HINTS[template.id]
                                : state.ready
                                  ? "Ready to send now"
                                  : `Missing ${state.total - state.filled} required field${state.total - state.filled === 1 ? "" : "s"}`}
                            </div>
                          </div>
                          <div className="ops-email-action-stack">
                            <button
                              className={`ops-email-send-btn${blocked ? " blocked" : ""}`}
                              disabled={isPending || blocked}
                              onClick={() => handleOpenDraft(template.id)}
                              type="button"
                            >
                              {pendingEmailId === template.id
                                ? "Sending..."
                                : singleSend && sent
                                  ? "Already Sent"
                                  : template.id === "t0"
                                    ? "Compose"
                                    : "Draft & Send"}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : (
                <div className="ops-email-history">
                  {!emailHistoryLoaded ? (
                    <div className="ops-draft-loading">Loading email history...</div>
                  ) : emailHistory.filter((m) => m.direction === emailSubTab).length === 0 ? (
                    <div className="ops-draft-loading">
                      {emailSubTab === "sent" ? "No emails sent to this client yet." : "No emails received from this client yet."}
                      {emailHistory.length === 0 ? " Gmail credentials may not be configured." : ""}
                    </div>
                  ) : (
                    <div className="ops-email-timeline">
                      {emailHistory
                        .filter((m) => m.direction === emailSubTab)
                        .map((msg) => {
                          const date = new Date(msg.date);
                          const isValid = !isNaN(date.getTime());
                          return (
                            <div className={`ops-timeline-item ${msg.direction}`} key={msg.id}>
                              <div className="ops-timeline-dot-col">
                                <div className={`ops-timeline-dot ${msg.direction}`} />
                                <div className="ops-timeline-line" />
                              </div>
                              <div className="ops-timeline-content">
                                <div className="ops-timeline-date">
                                  {isValid
                                    ? date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })
                                    : msg.date}
                                </div>
                                <div className="ops-timeline-subject">{msg.subject || "(No subject)"}</div>
                                <div className="ops-timeline-snippet">{msg.snippet}</div>
                                <div className="ops-timeline-meta">
                                  {msg.direction === "sent" ? `To: ${msg.to}` : `From: ${msg.from}`}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  )}
                  <div style={{ textAlign: "center", marginTop: 12 }}>
                    <button className="ops-draft-cancel" onClick={() => loadEmailHistory(true)} type="button">Refresh</button>
                  </div>
                </div>
              )}
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
                      <small>{url ? "Available for email workflow" : "Not created"}</small>
                    </div>
                  </a>
                ))}
              </div>
              <div className="ops-section-label">Matched Payments</div>
              <div className="ops-activity-list">
                {!paymentsLoaded ? (
                  <div className="ops-draft-loading">Loading payments...</div>
                ) : payments.length === 0 ? (
                  <div className="ops-draft-loading">No matched payment emails yet.</div>
                ) : (
                  payments.map((payment) => (
                    <div className="ops-activity-item" key={payment.id}>
                      <div className="ops-activity-date">
                        {formatDateTime(payment.processedAt || payment.createdAt)}
                      </div>
                      <div className="ops-activity-text">
                        <span className="ops-activity-badge payment">Payment</span>
                        {formatMoney(payment.amount)} from {payment.clientName}
                      </div>
                      <div className="ops-activity-subline">
                        {payment.clientEmail || "No reply-to email"} • {payment.paymentMethod} • Order #{payment.orderNumber}
                      </div>
                      <div className="ops-activity-subline">
                        {payment.productName || payment.rawSubject}
                        {payment.matchedBy ? ` • matched by ${payment.matchedBy}` : ""}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : null}

          {tab === "activity" ? (
            <div>
              {!activityLoaded ? (
                <div className="ops-draft-loading">Tap Activity in the footer to load.</div>
              ) : activityLog.length === 0 && notesList.length === 0 ? (
                <div className="ops-draft-loading">Loading activity...</div>
              ) : (
                <>
                  <div className="ops-section-label" style={{ marginTop: 0 }}>Add Note</div>
                  <div className="ops-note-input-row">
                    <textarea
                      className="ops-draft-textarea"
                      onChange={(e) => setNewNoteText(e.target.value)}
                      placeholder="Type a note..."
                      rows={3}
                      value={newNoteText}
                    />
                    <button
                      className="ops-draft-send"
                      disabled={isPending || !newNoteText.trim()}
                      onClick={handleAddNote}
                      type="button"
                      style={{ marginTop: 8, width: "100%" }}
                    >
                      {isPending ? "Saving..." : "Add Note"}
                    </button>
                  </div>

                  {notesList.length > 0 ? (
                    <>
                      <div className="ops-section-label">Notes</div>
                      <div className="ops-activity-list">
                        {notesList.map((note) => (
                          <div className="ops-activity-item ops-note-item" key={note.id}>
                            <div className="ops-activity-date">
                              {new Date(note.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                              <span className="ops-activity-author">{note.author}</span>
                            </div>
                            <div className="ops-activity-text">{note.text}</div>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : null}

                  {activityLog.length > 0 ? (
                    <>
                      <div className="ops-section-label">Timeline</div>
                      <div className="ops-activity-list">
                        {activityLog.map((event) => (
                          <div className="ops-activity-item" key={event.id}>
                            <div className="ops-activity-date">
                              {new Date(event.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })}
                            </div>
                            <div className="ops-activity-text">
                              <span className={`ops-activity-badge ${
                                event.eventType.includes("EMAIL") ? "email"
                                : event.eventType === "NOTE_ADDED" ? "note"
                                : event.eventType === "INQUIRY_RECEIVED" ? "inquiry"
                                : event.eventType === "PAYMENT_DETECTED" ? "payment"
                                : event.eventType.includes("WORKFLOW") ? "checklist"
                                : "status"
                              }`}>
                                {event.eventType === "EMAIL_TEST_SENT" || event.eventType === "EMAIL_SENT" ? "Email"
                                  : event.eventType === "NOTE_ADDED" ? "Note"
                                  : event.eventType === "INQUIRY_RECEIVED" ? "Inquiry"
                                  : event.eventType === "BUYOUT_CREATED" ? "Created"
                                  : event.eventType === "WORKFLOW_STEP_COMPLETED" ? "Checklist"
                                  : event.eventType === "PAYMENT_DETECTED" ? "Payment"
                                  : event.eventType === "LAST_ACTION_RECORDED" ? "Action"
                                  : "Event"}
                              </span>
                              {event.summary}
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <div className="ops-draft-loading">No activity recorded yet.</div>
                  )}
                </>
              )}
            </div>
          ) : null}
        </div>

        <div className="ops-drawer-footer">
          {previewHtml ? (
            <>
              <button className="ops-footer-primary" disabled={isPending} onClick={handleConfirmSend} type="button">
                {isPending ? "Sending..." : "Confirm & Send"}
              </button>
              <button className="ops-footer-secondary" onClick={() => setPreviewHtml(null)} type="button">
                Back to Editor
              </button>
              <button className="ops-footer-tertiary" onClick={handleCloseDraft} type="button">
                Cancel
              </button>
            </>
          ) : draftTemplate ? (
            <>
              <button className="ops-footer-primary" disabled={isPending || draftLoading} onClick={handleConfirmSend} type="button">
                {isPending ? "Sending..." : "Send Email"}
              </button>
              <button className="ops-footer-secondary" disabled={draftLoading} onClick={handlePreviewDraft} type="button">
                Preview First
              </button>
              <button className="ops-footer-tertiary" onClick={handleCloseDraft} type="button">
                Cancel
              </button>
            </>
          ) : tab === "activity" ? (
            <>
              <button className="ops-footer-primary" onClick={() => { setActivityLoaded(false); setActivityLog([]); setNotesList([]); setTimeout(loadActivity, 50); setActivityLoaded(true); }} type="button">
                Refresh
              </button>
              <button className="ops-footer-secondary" onClick={() => { setTab("emails"); setEditorMode(null); }} type="button">
                Emails
              </button>
              <button className="ops-footer-tertiary" onClick={() => { setTab("overview"); setEditorMode(null); }} type="button">
                Overview
              </button>
            </>
          ) : (
            <>
              <button className="ops-footer-primary" onClick={() => { setTab("emails"); setEditorMode(null); }} type="button">
                Emails
              </button>
              <button className="ops-footer-secondary" onClick={() => { setTab("overview"); setEditorMode("details"); }} type="button">
                Edit Details
              </button>
              <button className="ops-footer-tertiary" onClick={() => { setTab("activity"); setActivityLoaded(true); loadActivity(); }} type="button">
                Activity
              </button>
            </>
          )}
        </div>
      </aside>
    </>
  );
}

type InboxAlert = {
  id: string;
  buyoutId: string;
  clientEmail: string;
  subject: string;
  snippet: string;
  receivedAt: string;
  hoursWaiting: number;
  isRead: boolean;
};

export function OperationsDashboard({ buyouts }: { buyouts: BuyoutSummary[] }) {
  const [localBuyouts, setLocalBuyouts] = useState(buyouts);
  const [selected, setSelected] = useState<BuyoutSummary | null>(null);
  const [filterBic, setFilterBic] = useState("All");
  const [filterLocation, setFilterLocation] = useState("All");
  const [filterStaff, setFilterStaff] = useState("All");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("eventDate");
  const [showCompleted, setShowCompleted] = useState(false);
  const [inboxAlerts, setInboxAlerts] = useState<InboxAlert[]>([]);

  useEffect(() => {
    fetch("/api/inbox-alerts")
      .then((r) => r.json())
      .then((data: { alerts?: InboxAlert[] }) => setInboxAlerts(data.alerts ?? []))
      .catch(() => {});

    const interval = setInterval(() => {
      fetch("/api/inbox-alerts")
        .then((r) => r.json())
        .then((data: { alerts?: InboxAlert[] }) => setInboxAlerts(data.alerts ?? []))
        .catch(() => {});
    }, 300000);

    return () => clearInterval(interval);
  }, []);

  const locations = useMemo(
    () => ["All", ...new Set(localBuyouts.map((buyout) => buyout.location).filter(Boolean))],
    [localBuyouts]
  );
  const staff = useMemo(
    () => ["All", ...new Set(localBuyouts.map((buyout) => buyout.assignedTo).filter(Boolean))],
    [localBuyouts]
  );

  const visible = useMemo(() => {
    return [...localBuyouts]
      .filter((buyout) => {
        if (!showCompleted && ["Complete", "Cancelled", "DOA", "Not Possible"].includes(buyout.lifecycleStage)) return false;
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
  }, [localBuyouts, filterBic, filterLocation, filterStaff, search, sort, showCompleted]);

  const active = localBuyouts.filter((buyout) => !["Complete", "Cancelled", "DOA", "Not Possible"].includes(buyout.lifecycleStage));
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
      {inboxAlerts.length > 0 ? (
        <div className="ops-inbox-alert-bar">
          <div className="ops-inbox-alert-icon">{inboxAlerts.length}</div>
          <div className="ops-inbox-alert-content">
            <div className="ops-inbox-alert-title">
              {inboxAlerts.length === 1 ? "1 client email needs a response" : `${inboxAlerts.length} client emails need responses`}
            </div>
            <div className="ops-inbox-alert-list">
              {inboxAlerts.slice(0, 3).map((alert) => {
                const buyout = localBuyouts.find((b) => b.id === alert.buyoutId);
                return (
                  <button
                    className="ops-inbox-alert-item"
                    key={alert.id}
                    onClick={() => { const b = localBuyouts.find((x) => x.id === alert.buyoutId); if (b) setSelected(b); }}
                    type="button"
                  >
                    <strong>{buyout?.name ?? alert.clientEmail}</strong>
                    <span>{alert.hoursWaiting >= 24 ? `${Math.floor(alert.hoursWaiting / 24)}d overdue` : `${alert.hoursWaiting}h ago`}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}

      <div className="ops-mode-banner">
        <div>
          <div className="ops-mode-title">Live operations view</div>
          <div className="ops-mode-copy">
            Dashboard now surfaces the active buyout pipeline while outbound email remains routed
            through the internal review workflow.
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
                      {buyout.paymentTier === "rush" ? (
                        <span className="ops-rush-pill">Rush</span>
                      ) : null}
                      <span>{buyout.assignedTo}</span>
                    </div>
                    <div className="ops-client-meta">
                      <span>{formatDisplayDate(buyout.eventDate)}</span>
                      <span>•</span>
                      <span>{buyout.location}</span>
                    </div>
                    {buyout.notes ? (
                      <div className="ops-client-note">{buyout.notes.slice(0, 80)}{buyout.notes.length > 80 ? "..." : ""}</div>
                    ) : null}
                    {buyout.ballInCourt === "Client" && buyout.daysWaiting > 7 ? (
                      <span className="ops-cold-badge">Going Cold</span>
                    ) : null}
                    {inboxAlerts.some((a) => a.buyoutId === buyout.id) ? (
                      <span className="ops-inbox-badge">Needs Response</span>
                    ) : null}
                    {buyout.responseUrgency === "overdue" || buyout.responseUrgency === "critical" ? (
                      <span className="ops-urgency-badge" style={{ background: buyout.responseUrgency === "critical" ? "#8b0000" : COLORS.cherry, color: "#fff" }}>{buyout.responseUrgency === "critical" ? "Critical" : "Overdue"}</span>
                    ) : buyout.responseUrgency === "needs-attention" ? (
                      <span className="ops-urgency-badge" style={{ background: COLORS.sunshine, color: COLORS.coffee }}>Follow Up</span>
                    ) : null}
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
                    {lifecycleSegments(buyout.lifecycleStep, buyout.lifecycleStage).map((color, index) => (
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

      {selected ? (
        <Drawer
          buyout={selected}
          onBuyoutUpdated={(updatedBuyout) => {
            setLocalBuyouts((current) =>
              current.map((buyout) => (buyout.id === updatedBuyout.id ? updatedBuyout : buyout))
            );
            setSelected(updatedBuyout);
          }}
          onClose={() => setSelected(null)}
        />
      ) : null}
    </div>
  );
}
