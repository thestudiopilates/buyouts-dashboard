import { BuyoutSummary } from "@/lib/types";

export function DashboardMetrics({ buyouts }: { buyouts: BuyoutSummary[] }) {
  const active = buyouts.length;
  const revenue = buyouts.reduce((sum, buyout) => sum + buyout.total, 0);
  const outstanding = buyouts.reduce((sum, buyout) => sum + (buyout.total - buyout.amountPaid), 0);
  const atRisk = buyouts.filter((buyout) => buyout.trackingHealth !== "On track").length;

  return (
    <div className="metrics-grid">
      <div className="metric">
        <p className="metric-label">Active buyouts</p>
        <p className="metric-value">{active}</p>
      </div>
      <div className="metric">
        <p className="metric-label">Pipeline value</p>
        <p className="metric-value">${revenue.toLocaleString()}</p>
      </div>
      <div className="metric">
        <p className="metric-label">Outstanding balance</p>
        <p className="metric-value">${outstanding.toLocaleString()}</p>
      </div>
      <div className="metric">
        <p className="metric-label">Needs attention</p>
        <p className="metric-value">{atRisk}</p>
      </div>
    </div>
  );
}
