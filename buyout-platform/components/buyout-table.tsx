import Link from "next/link";

import { BuyoutSummary } from "@/lib/types";

function trackingClass(value: BuyoutSummary["trackingHealth"]) {
  if (value === "Major issue") return "danger";
  if (value === "At risk") return "warning";
  if (value === "Complete") return "neutral";
  return "positive";
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
          <div>
            <Link href={`/buyouts/${buyout.id}`} style={{ fontWeight: 700 }}>
              {buyout.name}
            </Link>
            <div className="muted">
              {buyout.eventType} · {buyout.location} · {buyout.assignedTo}
            </div>
          </div>
          <span className={`pill ${trackingClass(buyout.trackingHealth)}`}>{buyout.lifecycleStage}</span>
          <span>{buyout.nextAction}</span>
          <span>{buyout.ballInCourt}</span>
          <span>{buyout.eventDate}</span>
          <span>
            {buyout.signups}/{buyout.capacity}
          </span>
          <span>${buyout.amountPaid}</span>
        </div>
      ))}
    </div>
  );
}
