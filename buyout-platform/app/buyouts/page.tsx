import { BuyoutTable } from "@/components/buyout-table";
import { PortalShell } from "@/components/portal-shell";
import { listBuyouts } from "@/lib/buyouts";

export const dynamic = "force-dynamic";

export default async function BuyoutsPage() {
  const buyouts = await listBuyouts();

  return (
    <div className="shell">
      <PortalShell activeHref="/buyouts">
        <div className="section-block">
          <p className="eyebrow">Buyouts module</p>
          <h1 className="page-title" style={{ fontSize: "2.4rem" }}>
            Pipeline and event management
          </h1>
          <p className="section-copy">
            This is the operating surface for the team. It should eventually own assignment,
            status, workflow, financials, and communications without Monday as the center.
          </p>
        </div>
        <div className="section-block" style={{ paddingTop: 0 }}>
          <BuyoutTable buyouts={buyouts} />
        </div>
      </PortalShell>
    </div>
  );
}
