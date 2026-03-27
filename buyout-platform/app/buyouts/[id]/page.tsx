import Link from "next/link";
import { notFound } from "next/navigation";

import { PortalShell } from "@/components/portal-shell";
import { getBuyout } from "@/lib/buyouts";

function formatCurrency(value: number) {
  return `$${value.toLocaleString()}`;
}

export default async function BuyoutDetailPage({
  params
}: {
  params: { id: string };
}) {
  const { id } = params;
  const buyout = await getBuyout(id);

  if (!buyout) {
    notFound();
  }

  const outstanding = buyout.total - buyout.amountPaid;
  const progress = Math.round(
    (buyout.workflow.filter((step) => step.complete).length / buyout.workflow.length) * 100
  );

  return (
    <div className="shell">
      <PortalShell activeHref="/buyouts">
        <div className="section-block">
          <div className="portal-topbar">
            <div>
              <Link className="eyebrow" href="/buyouts">
                Back to buyouts
              </Link>
              <h1 className="page-title" style={{ fontSize: "2.4rem" }}>
                {buyout.name}
              </h1>
              <p className="section-copy">
                {buyout.eventType} at {buyout.location} on {buyout.eventDate}
              </p>
            </div>
            <div className="header-actions">
              <span className="pill positive">{buyout.lifecycleStage}</span>
              <span className="pill neutral">{buyout.ballInCourt}</span>
            </div>
          </div>

          <div className="detail-grid">
            <div className="stack">
              <section className="detail-card card">
                <h2 className="section-title" style={{ fontSize: "1.5rem", marginTop: 0 }}>
                  Operational overview
                </h2>
                <div className="grid-4">
                  <div className="metric">
                    <p className="metric-label">Assigned manager</p>
                    <p className="metric-value" style={{ fontSize: "1.3rem" }}>
                      {buyout.assignedTo}
                    </p>
                  </div>
                  <div className="metric">
                    <p className="metric-label">Sign-ups</p>
                    <p className="metric-value" style={{ fontSize: "1.3rem" }}>
                      {buyout.signups}/{buyout.capacity}
                    </p>
                  </div>
                  <div className="metric">
                    <p className="metric-label">Paid</p>
                    <p className="metric-value" style={{ fontSize: "1.3rem" }}>
                      {formatCurrency(buyout.amountPaid)}
                    </p>
                  </div>
                  <div className="metric">
                    <p className="metric-label">Outstanding</p>
                    <p className="metric-value" style={{ fontSize: "1.3rem" }}>
                      {formatCurrency(outstanding)}
                    </p>
                  </div>
                </div>

                <div style={{ marginTop: "1rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.45rem" }}>
                    <span className="metric-label">Workflow completion</span>
                    <span className="metric-label">{progress}%</span>
                  </div>
                  <div className="progress">
                    <span style={{ width: `${progress}%` }} />
                  </div>
                </div>
              </section>

              <section className="detail-card card">
                <h2 className="section-title" style={{ fontSize: "1.5rem", marginTop: 0 }}>
                  Team notes
                </h2>
                <p className="section-copy">{buyout.notes}</p>
                <p className="section-copy">
                  Next action: <strong>{buyout.nextAction}</strong>
                </p>
              </section>
            </div>

            <aside className="stack">
              <section className="sidebar card">
                <h2 className="section-title" style={{ fontSize: "1.45rem", marginTop: 0 }}>
                  Workflow
                </h2>
                <div className="workflow-list">
                  {buyout.workflow.map((step) => (
                    <div className="workflow-item" key={step.key}>
                      <div>
                        <div>{step.label}</div>
                        <div className="workflow-meta">{step.group}</div>
                      </div>
                      <span className={`pill ${step.complete ? "positive" : "neutral"}`}>
                        {step.complete ? "Done" : "Open"}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            </aside>
          </div>
        </div>
      </PortalShell>
    </div>
  );
}
