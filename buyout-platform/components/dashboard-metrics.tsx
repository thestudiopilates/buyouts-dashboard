import { BuyoutSummary } from "@/lib/types";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0
  }).format(value);
}

export function DashboardMetrics({ buyouts }: { buyouts: BuyoutSummary[] }) {
  const active = buyouts.length;
  const revenue = buyouts.reduce((sum, buyout) => sum + buyout.total, 0);
  const outstanding = buyouts.reduce((sum, buyout) => sum + buyout.outstanding, 0);
  const atRisk = buyouts.filter(
    (buyout) => buyout.trackingHealth !== "On track" || buyout.daysWaiting > 5
  ).length;
  const thisWeek = buyouts.filter(
    (buyout) => buyout.countdownDays !== null && buyout.countdownDays >= 0 && buyout.countdownDays <= 7
  ).length;
  const clientOwned = buyouts.filter((buyout) => buyout.ballInCourt === "Client").length;

  return (
    <div className="metrics-grid">
      <div className="metric">
        <p className="metric-label">Active buyouts</p>
        <p className="metric-value">{active}</p>
        <p className="metric-subtext">{clientOwned} waiting on client action</p>
      </div>
      <div className="metric">
        <p className="metric-label">This week</p>
        <p className="metric-value">{thisWeek}</p>
        <p className="metric-subtext">Events in the next 7 days</p>
      </div>
      <div className="metric">
        <p className="metric-label">Needs attention</p>
        <p className="metric-value">{atRisk}</p>
        <p className="metric-subtext">At risk or overdue follow-up</p>
      </div>
      <div className="metric">
        <p className="metric-label">Pipeline value</p>
        <p className="metric-value">{formatCurrency(revenue)}</p>
        <p className="metric-subtext">Quoted revenue across active buyouts</p>
      </div>
      <div className="metric">
        <p className="metric-label">Outstanding</p>
        <p className="metric-value">{formatCurrency(outstanding)}</p>
        <p className="metric-subtext">Remaining unpaid balance</p>
      </div>
    </div>
  );
}
