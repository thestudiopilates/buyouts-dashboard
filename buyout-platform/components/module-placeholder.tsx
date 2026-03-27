import { PortalShell } from "@/components/portal-shell";

export function ModulePlaceholder({
  title,
  eyebrow,
  description,
  activeHref
}: {
  title: string;
  eyebrow: string;
  description: string;
  activeHref: string;
}) {
  return (
    <div className="shell">
      <PortalShell activeHref={activeHref}>
        <div className="section-block">
          <p className="eyebrow">{eyebrow}</p>
          <h1 className="page-title" style={{ fontSize: "2.4rem" }}>
            {title}
          </h1>
          <p className="section-copy">{description}</p>
          <div className="detail-card card" style={{ marginTop: "1rem" }}>
            <h2 className="section-title" style={{ fontSize: "1.5rem", marginTop: 0 }}>
              Planned next
            </h2>
            <p className="section-copy">
              This module is intentionally stubbed so the management portal has a stable navigation
              structure while Buyouts becomes the first complete operational workflow.
            </p>
          </div>
        </div>
      </PortalShell>
    </div>
  );
}
