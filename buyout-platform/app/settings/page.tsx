import { EmailTemplateWorkspace } from "@/components/email-template-workspace";
import { PortalShell } from "@/components/portal-shell";
import { getEmailWorkspaceData } from "@/lib/email-templates";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const { templates, buyout, previews, activity, gmail } = await getEmailWorkspaceData();

  return (
    <div className="shell">
      <PortalShell activeHref="/settings">
        <div className="section-block">
          <div className="portal-topbar">
            <div>
              <p className="eyebrow">Admin and settings</p>
              <h1 className="page-title" style={{ fontSize: "2.5rem" }}>
                Email templates and workflow rules
              </h1>
              <p className="section-copy">
                Edit the source-controlled templates, inspect workflow effects, and preview each message
                against a live buyout before it is sent through the internal review path.
              </p>
            </div>
          </div>

          <section style={{ marginTop: "1.25rem" }}>
            <EmailTemplateWorkspace
              buyout={buyout}
              gmail={gmail}
              initialActivity={activity}
              initialPreviews={previews}
              initialTemplates={templates}
            />
          </section>
        </div>
      </PortalShell>
    </div>
  );
}
