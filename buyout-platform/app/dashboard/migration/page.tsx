import { PortalShell } from "@/components/portal-shell";
import { mondayImportChecklist, mondayImportOutputs } from "@/lib/migration-plan";
import { MONDAY_IMPORT_NOTES } from "@/lib/monday-mapping";

export default function MigrationPage() {
  return (
    <div className="shell">
      <PortalShell activeHref="/dashboard">
        <div className="section-block">
          <p className="eyebrow">Migration workspace</p>
          <h1 className="page-title" style={{ fontSize: "2.4rem" }}>
            Monday import readiness
          </h1>
          <p className="section-copy">
            This page summarizes the current import plan so the team can migrate existing buyouts
            into the new platform without losing operational context.
          </p>

          <div className="detail-grid">
            <section className="detail-card card">
              <h2 className="section-title" style={{ fontSize: "1.5rem", marginTop: 0 }}>
                Import checklist
              </h2>
              <div className="workflow-list">
                {mondayImportChecklist.map((item) => (
                  <div className="workflow-item" key={item}>
                    <div>{item}</div>
                    <span className="pill neutral">Pending</span>
                  </div>
                ))}
              </div>
            </section>

            <section className="sidebar card">
              <h2 className="section-title" style={{ fontSize: "1.45rem", marginTop: 0 }}>
                Current gaps
              </h2>
              <div className="workflow-list">
                {MONDAY_IMPORT_NOTES.unresolvedColumns.map((item) => (
                  <div className="workflow-item" key={item}>
                    <div>{item}</div>
                    <span className="pill warning">Need export</span>
                  </div>
                ))}
              </div>

              <h2 className="section-title" style={{ fontSize: "1.45rem" }}>
                Planned outputs
              </h2>
              <div className="workflow-list">
                {mondayImportOutputs.map((item) => (
                  <div className="workflow-item" key={item}>
                    <div>{item}</div>
                    <span className="pill positive">Target</span>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>
      </PortalShell>
    </div>
  );
}
