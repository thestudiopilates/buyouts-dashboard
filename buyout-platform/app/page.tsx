import Link from "next/link";

import { SiteHeader } from "@/components/site-header";

export default function HomePage() {
  return (
    <div className="shell">
      <SiteHeader />
      <main className="hero">
        <div className="container hero-grid">
          <section className="hero-card">
            <span className="eyebrow">Buyouts first. Full operations portal next.</span>
            <h1>Own the buyout workflow from website inquiry to team execution.</h1>
            <p>
              This new platform is designed to replace the Monday and Make workflow with a
              first-party system that supports intake, assignments, notes, email, payments, and
              future management modules in one place.
            </p>
            <div className="hero-actions">
              <Link className="btn btn-primary" href="/buyouts/inquire">
                Open public inquiry form
              </Link>
              <Link className="btn btn-secondary" href="/dashboard">
                Open internal dashboard
              </Link>
            </div>
          </section>

          <section className="hero-card">
            <div className="grid-3">
              <div className="metric">
                <p className="metric-label">Intake</p>
                <p className="metric-value">Website form</p>
              </div>
              <div className="metric">
                <p className="metric-label">System of record</p>
                <p className="metric-value">PostgreSQL</p>
              </div>
              <div className="metric">
                <p className="metric-label">Automation</p>
                <p className="metric-value">Native jobs</p>
              </div>
            </div>
            <p className="section-copy" style={{ marginTop: "1rem" }}>
              The app shell is already structured for future modules like projects, studio
              schedule, front desk, reporting, and admin.
            </p>
          </section>
        </div>
      </main>
    </div>
  );
}
