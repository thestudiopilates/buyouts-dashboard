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
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const buyout = await getBuyout(id);

  if (!buyout) {
    notFound();
  }

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
              <span className="pill positive">{buyout.statusLabel}</span>
              <span className="ball-pill client">{buyout.ballInCourt}</span>
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
                    <p className="metric-label">Assigned staff</p>
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
                      {formatCurrency(buyout.outstanding)}
                    </p>
                  </div>
                </div>

                <div className="detail-info-grid">
                  <div className="info-line">
                    <span>Stage</span>
                    <strong>{buyout.statusLabel}</strong>
                  </div>
                  <div className="info-line">
                    <span>Next action</span>
                    <strong>{buyout.nextAction}</strong>
                  </div>
                  <div className="info-line">
                    <span>Tracking health</span>
                    <strong>{buyout.trackingHealth}</strong>
                  </div>
                  <div className="info-line">
                    <span>Event countdown</span>
                    <strong>
                      {buyout.countdownDays === null
                        ? "TBD"
                        : buyout.countdownDays < 0
                          ? "Past"
                          : `${buyout.countdownDays} days`}
                    </strong>
                  </div>
                  <div className="info-line">
                    <span>Instructor</span>
                    <strong>{buyout.instructor}</strong>
                  </div>
                  <div className="info-line">
                    <span>Time</span>
                    <strong>
                      {buyout.startTime && buyout.endTime
                        ? `${buyout.startTime} - ${buyout.endTime}`
                        : "TBD"}
                    </strong>
                  </div>
                </div>
              </section>

              <section className="detail-card card">
                <h2 className="section-title" style={{ fontSize: "1.5rem", marginTop: 0 }}>
                  Contacts and links
                </h2>
                <div className="detail-info-grid">
                  <div className="info-line">
                    <span>Email</span>
                    <strong>{buyout.clientEmail || "Not captured"}</strong>
                  </div>
                  <div className="info-line">
                    <span>Phone</span>
                    <strong>{buyout.clientPhone || "Not captured"}</strong>
                  </div>
                  <div className="info-line">
                    <span>Deposit link</span>
                    <strong>{buyout.depositLink ? "Ready" : "Missing"}</strong>
                  </div>
                  <div className="info-line">
                    <span>Balance link</span>
                    <strong>{buyout.balanceLink ? "Ready" : "Missing"}</strong>
                  </div>
                  <div className="info-line">
                    <span>Sign-up link</span>
                    <strong>{buyout.signupLink ? "Ready" : "Missing"}</strong>
                  </div>
                  <div className="info-line">
                    <span>Last team action</span>
                    <strong>{buyout.lastAction || "Unknown"}</strong>
                  </div>
                </div>
              </section>

              <section className="detail-card card">
                <h2 className="section-title" style={{ fontSize: "1.5rem", marginTop: 0 }}>
                  Team notes
                </h2>
                <pre className="notes-block">{buyout.notes || "No notes captured yet."}</pre>
              </section>
            </div>

            <aside className="stack">
              <section className="sidebar card">
                <h2 className="section-title" style={{ fontSize: "1.45rem", marginTop: 0 }}>
                  Workflow
                </h2>
                <div className="detail-progress-summary">
                  <span className="metric-label">Checklist completion</span>
                  <strong>{buyout.workflowProgress}%</strong>
                </div>
                <div className="progress">
                  <span style={{ width: `${buyout.workflowProgress}%` }} />
                </div>
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

              <section className="sidebar card">
                <h2 className="section-title" style={{ fontSize: "1.45rem", marginTop: 0 }}>
                  Financials
                </h2>
                <div className="detail-progress-summary">
                  <span className="metric-label">Payment progress</span>
                  <strong>{buyout.paymentProgress}%</strong>
                </div>
                <div className="progress">
                  <span style={{ width: `${buyout.paymentProgress}%` }} />
                </div>
                <div className="detail-info-grid" style={{ marginTop: "1rem" }}>
                  <div className="info-line">
                    <span>Total quoted</span>
                    <strong>{formatCurrency(buyout.total)}</strong>
                  </div>
                  <div className="info-line">
                    <span>Amount paid</span>
                    <strong>{formatCurrency(buyout.amountPaid)}</strong>
                  </div>
                  <div className="info-line">
                    <span>Remaining</span>
                    <strong>{formatCurrency(buyout.outstanding)}</strong>
                  </div>
                </div>
              </section>
            </aside>
          </div>
        </div>
      </PortalShell>
    </div>
  );
}
