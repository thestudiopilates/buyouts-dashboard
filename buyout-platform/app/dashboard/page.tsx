import Link from "next/link";

import { DashboardMetrics } from "@/components/dashboard-metrics";
import { PortalShell } from "@/components/portal-shell";
import { BuyoutTable } from "@/components/buyout-table";
import { listBuyouts } from "@/lib/buyouts";

export default async function DashboardPage() {
  const buyouts = await listBuyouts();

  return (
    <div className="shell">
      <PortalShell activeHref="/dashboard">
        <div className="section-block">
          <div className="portal-topbar">
            <div>
              <p className="eyebrow">Management home</p>
              <h1 className="page-title" style={{ fontSize: "2.5rem" }}>
                Buyout operations dashboard
              </h1>
              <p className="section-copy">
                The first module in the new management portal. From here we can expand into
                projects, scheduling, reporting, and cross-team workflows.
              </p>
            </div>
            <Link className="btn btn-primary" href="/buyouts/inquire">
              Open public inquiry form
            </Link>
          </div>

          <DashboardMetrics buyouts={buyouts} />

          <section style={{ marginTop: "1.25rem" }}>
            <div className="table-card">
              <div className="section-block">
                <h2 className="section-title" style={{ fontSize: "1.7rem", marginTop: 0 }}>
                  Active buyouts
                </h2>
                <p className="section-copy">
                  This view is now powered by imported Monday buyout records stored in Supabase, so
                  the team can review the real pipeline shape inside the new portal.
                </p>
                <p className="section-copy">
                  Monday migration planning is now tracked in the migration workspace so we can
                  continue refining the imported data and replace remaining manual process gaps.
                </p>
              </div>
              <BuyoutTable buyouts={buyouts} />
            </div>
          </section>
        </div>
      </PortalShell>
    </div>
  );
}
