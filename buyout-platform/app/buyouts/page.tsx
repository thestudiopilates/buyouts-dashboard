import Link from "next/link";

import { PortalShell } from "@/components/portal-shell";
import { OperationsDashboard } from "@/components/operations-dashboard";
import { listBuyouts } from "@/lib/buyouts";

export const dynamic = "force-dynamic";

export default async function BuyoutsPage() {
  const buyouts = await listBuyouts();

  return (
    <div className="shell">
      <PortalShell activeHref="/buyouts">
        <div className="section-block">
          <div className="portal-topbar">
            <div>
              <p className="eyebrow">Buyout Operations</p>
              <h1 className="page-title" style={{ fontSize: "2.4rem" }}>
                Pipeline &amp; Event Management
              </h1>
            </div>
            <Link className="btn btn-primary" href="/buyouts/inquire">
              New Inquiry
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
