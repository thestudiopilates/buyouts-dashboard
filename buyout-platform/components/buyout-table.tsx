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

export function BuyoutTable({ buyouts }: { buyouts: BuyoutSummary[] }) {
  return (
    <div className="table-card">
      <div className="table-header">
        <span>Client</span>
        <span>Stage</span>
        <span>Next Action</span>
        <span>Ball in Court</span>
        <span>Event Date</span>
        <span>Sign-Ups</span>
        <span>Paid</span>
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
          <span className={`pill ${trackingClass(buyout.trackingHealth)}`}>{buyout.lifecycleStage}</span>
          <span className="next-action">{buyout.nextAction}</span>
          <span className={`ball-pill ${ballClass(buyout.ballInCourt)}`}>{buyout.ballInCourt}</span>
          <span className="date-cell">{buyout.eventDate}</span>
          <span className="signup-cell">
            {buyout.signups}/{buyout.capacity}
          </span>
          <span className="money-cell">{money(buyout.amountPaid)}</span>
        </div>
      ))}
    </div>
  );
}
