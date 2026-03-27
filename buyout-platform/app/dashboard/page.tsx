import Link from "next/link";

import { PortalShell } from "@/components/portal-shell";
import { OperationsDashboard } from "@/components/operations-dashboard";
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
          <section style={{ marginTop: "1.25rem" }}>
            <OperationsDashboard buyouts={buyouts} />
          </section>
        </div>
      </PortalShell>
    </div>
  );
}
