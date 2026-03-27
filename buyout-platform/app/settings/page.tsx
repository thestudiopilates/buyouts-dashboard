import { ModulePlaceholder } from "@/components/module-placeholder";

export default function SettingsPage() {
  return (
    <ModulePlaceholder
      activeHref="/settings"
      eyebrow="Admin and settings"
      title="Settings"
      description="This section is reserved for team roles, templates, automation controls, integrations, and workspace-level configuration."
    />
  );
}
