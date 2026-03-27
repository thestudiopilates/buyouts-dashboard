import Link from "next/link";

import { BuyoutSummary } from "@/lib/types";

function trackingClass(value: BuyoutSummary["trackingHealth"]) {
  if (value === "Major issue") return "danger";
  if (value === "At risk") return "warning";
  if (value === "Complete") return "neutral";
  return "positive";
}

function ballClass(value: BuyoutSummary["ballInCourt"]) {
  if (value === "Client") return "client";
  if (value === "Both") return "both";
  return "team";
}

function money(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0
  }).format(value);
}

function countdownClass(days: number | null) {
  if (days === null) return "unknown";
  if (days < 0) return "past";
  if (days <= 3) return "urgent";
  if (days <= 6) return "close";
  if (days <= 13) return "warning";
  return "healthy";
}

function nextActionClass(daysWaiting: number) {
  if (daysWaiting > 5) return "danger";
  if (daysWaiting > 2) return "warning";
  return "positive";
}

export function BuyoutTable({ buyouts }: { buyouts: BuyoutSummary[] }) {
  return (
    <div className="table-card">
      <div className="table-header">
        <span>Client</span>
        <span>Stage</span>
        <span>Next Action</span>
        <span>Waiting On</span>
        <span>Countdown</span>
        <span>Sign-Ups</span>
        <span>Progress</span>
      </div>
      {buyouts.map((buyout) => (
        <div className="table-row" key={buyout.id}>
          <div className="client-cell">
            <Link className="client-link" href={`/buyouts/${buyout.id}`}>
              {buyout.name}
            </Link>
            <div className="client-meta">
              {buyout.eventType} · {buyout.location} · {buyout.assignedTo}
            </div>
          </div>
          <div>
            <span className={`pill ${trackingClass(buyout.trackingHealth)}`}>{buyout.statusLabel}</span>
            <div className="lifecycle-strip" aria-hidden="true">
              {Array.from({ length: 12 }).map((_, index) => (
                <span
                  className={
                    index < buyout.lifecycleStep
                      ? "done"
                      : index === Math.min(buyout.lifecycleStep, 11)
                        ? "current"
                        : ""
                  }
                  key={`${buyout.id}_${index}`}
                />
              ))}
            </div>
          </div>
          <div className="next-action-cell">
            <span className={`next-action ${nextActionClass(buyout.daysWaiting)}`}>{buyout.nextAction}</span>
            {buyout.daysWaiting > 0 ? (
              <span className={`waiting-chip ${nextActionClass(buyout.daysWaiting)}`}>
                {buyout.daysWaiting}d waiting
              </span>
            ) : null}
          </div>
          <span className={`ball-pill ${ballClass(buyout.ballInCourt)}`}>{buyout.ballInCourt}</span>
          <div className="countdown-cell">
            <span className={`countdown-badge ${countdownClass(buyout.countdownDays)}`}>
              {buyout.countdownDays === null ? "TBD" : buyout.countdownDays < 0 ? "Past" : buyout.countdownDays}
            </span>
          </div>
          <div className="progress-cell">
            <div className="progress-value">
              {buyout.signups}/{buyout.capacity || 0}
            </div>
            <div className="mini-progress">
              <span style={{ width: `${buyout.signupFillPercent ?? 0}%` }} />
            </div>
          </div>
          <div className="progress-cell">
            <div className="progress-value">{buyout.workflowProgress}%</div>
            <div className="mini-progress workflow">
              <span style={{ width: `${buyout.workflowProgress}%` }} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
