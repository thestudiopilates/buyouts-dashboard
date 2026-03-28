"use client";

import { useMemo, useState, useTransition } from "react";

import { renderEmailHtml } from "@/lib/email-renderer";
import type { EmailActivityRecord, EmailTemplatePreview, EmailTemplateRecord } from "@/lib/email-templates";
import type { GmailReadiness } from "@/lib/gmail";
import type { BuyoutSummary } from "@/lib/types";

function renderTemplate(input: string, variables: Record<string, string>) {
  return input.replace(/\{\{([^}]+)\}\}/g, (_, token) => {
    const normalizedToken = token
      .trim()
      .replace(/[^\w\s]/g, "")
      .replace(/\s+/g, " ")
      .toLowerCase();

    const match = Object.entries(variables).find(([variableKey]) => {
      const normalizedKey = variableKey
        .replace(/([A-Z])/g, " $1")
        .trim()
        .toLowerCase();
      return normalizedKey === normalizedToken;
    });

    return match?.[1] || `{{${token}}}`;
  });
}

function isSingleSendTemplate(template: EmailTemplateRecord) {
  return (template.effectConfig.sendPolicy ?? "repeatable") === "single";
}

function sendPolicyLabel(template: EmailTemplateRecord) {
  return isSingleSendTemplate(template) ? "One-time workflow action" : "Repeatable follow-up";
}

export function EmailTemplateWorkspace({
  initialTemplates,
  initialPreviews,
  initialActivity,
  gmail,
  buyout
}: {
  initialTemplates: EmailTemplateRecord[];
  initialPreviews: EmailTemplatePreview[];
  initialActivity: EmailActivityRecord[];
  gmail: GmailReadiness;
  buyout: BuyoutSummary | null;
}) {
  const [templates, setTemplates] = useState(initialTemplates);
  const [activity, setActivity] = useState(initialActivity);
  const [previewBuyout, setPreviewBuyout] = useState(buyout);
  const [selectedKey, setSelectedKey] = useState(initialTemplates[0]?.key ?? "");
  const [subjectTemplate, setSubjectTemplate] = useState(initialTemplates[0]?.subjectTemplate ?? "");
  const [bodyTemplate, setBodyTemplate] = useState(initialTemplates[0]?.bodyTemplate ?? "");
  const [saveMessage, setSaveMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  const selectedTemplate = useMemo(
    () => templates.find((template) => template.key === selectedKey) ?? templates[0] ?? null,
    [selectedKey, templates]
  );

  const selectedPreview = useMemo(
    () => initialPreviews.find((preview) => preview.key === selectedKey) ?? initialPreviews[0] ?? null,
    [initialPreviews, selectedKey]
  );

  const livePreview = useMemo(() => {
    if (!selectedTemplate || !selectedPreview) {
      return null;
    }

    const missing = selectedTemplate.requiredVariables
      .filter((item) => !selectedPreview.variables[item.key])
      .map((item) => item.label);

    return {
      renderedSubject: renderTemplate(subjectTemplate, selectedPreview.variables),
      renderedBody: renderTemplate(bodyTemplate, selectedPreview.variables),
      renderedHtml: renderEmailHtml({
        subject: renderTemplate(subjectTemplate, selectedPreview.variables),
        body: renderTemplate(bodyTemplate, selectedPreview.variables),
        previewLabel: selectedTemplate.name
      }),
      missing
    };
  }, [bodyTemplate, selectedPreview, selectedTemplate, subjectTemplate]);

  const stageAllowed = useMemo(() => {
    if (!selectedTemplate || !previewBuyout) {
      return false;
    }

    return selectedTemplate.allowedStages.includes(previewBuyout.lifecycleStage);
  }, [previewBuyout, selectedTemplate]);

  const alreadySent = useMemo(() => {
    if (!selectedTemplate || !previewBuyout) {
      return false;
    }

    return isSingleSendTemplate(selectedTemplate) && previewBuyout.sentTemplateIds.includes(selectedTemplate.key);
  }, [previewBuyout, selectedTemplate]);

  function handleSelect(key: string) {
    const nextTemplate = templates.find((template) => template.key === key);
    setSelectedKey(key);
    setSubjectTemplate(nextTemplate?.subjectTemplate ?? "");
    setBodyTemplate(nextTemplate?.bodyTemplate ?? "");
    setSaveMessage("");
  }

  function handleSave() {
    if (!selectedTemplate) {
      return;
    }

    startTransition(async () => {
      setSaveMessage("");
      const response = await fetch(`/api/email-templates/${selectedTemplate.key}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subjectTemplate, bodyTemplate })
      });

      if (!response.ok) {
        setSaveMessage("Unable to save template right now.");
        return;
      }

      const payload = (await response.json()) as { template: EmailTemplateRecord };
      setTemplates((current) =>
        current.map((template) => (template.key === payload.template.key ? payload.template : template))
      );
      setSaveMessage("Template saved. Preview refreshes on next page load.");
    });
  }

  function handleTestSend() {
    if (!selectedTemplate) {
      return;
    }

    startTransition(async () => {
      setSaveMessage("");
      const response = await fetch(`/api/email-templates/${selectedTemplate.key}/test-send`, {
        method: "POST"
      });

      const payload = (await response.json()) as {
        message?: string;
        error?: string;
        activity?: EmailActivityRecord[];
        buyout?: BuyoutSummary;
      };

      if (!response.ok) {
        setSaveMessage(payload.error ?? "Unable to run the internal review send right now.");
        return;
      }

      if (payload.activity) {
        setActivity(payload.activity);
      }

      if (payload.buyout) {
        setPreviewBuyout(payload.buyout);
      }

      setSaveMessage(payload.message ?? "Internal review send completed.");
    });
  }

  if (!selectedTemplate) {
    return <div className="card" style={{ padding: "1.5rem" }}>No templates available yet.</div>;
  }

  return (
    <div className="template-workspace">
      <aside className="template-sidebar">
        <div className="template-sidebar-head">
          <p className="eyebrow">Template Logic</p>
          <h2 className="template-title">Email workspace</h2>
          <p className="section-copy">
            Templates are treated as workflow actions. Edit content here, review the exact stage impact, and send internal review emails only when the buyout is actually ready.
          </p>
          <div className={`template-delivery-card${gmail.ready ? " ready" : " blocked"}`}>
            <div className="template-delivery-title">
              {gmail.ready ? "Internal review sending is live" : "Simulated mode active"}
            </div>
            <div className="template-delivery-copy">
              {gmail.ready
                ? `Internal review emails will go out from ${gmail.senderEmail}.`
                : "Internal review sends will be recorded in-app until Gmail credentials are added."}
            </div>
            {!gmail.ready && gmail.missing.length > 0 ? (
              <div className="template-delivery-missing">Missing: {gmail.missing.join(", ")}</div>
            ) : null}
          </div>
        </div>

        <div className="template-list">
          {templates.map((template) => (
            <button
              className={`template-list-item${template.key === selectedKey ? " active" : ""}`}
              key={template.key}
              onClick={() => handleSelect(template.key)}
              type="button"
            >
              <div>
                <div className="template-list-name">
                  {template.key.toUpperCase()} · {template.name}
                </div>
                <div className="template-list-meta">
                  {template.category} · {template.effectConfig.eventType ?? "informational"}
                </div>
              </div>
              <span className="template-list-trigger">{template.triggerLabel}</span>
            </button>
          ))}
        </div>
      </aside>

      <section className="template-editor-panel">
        <div className="template-panel-card">
          <div className="template-panel-head">
            <div>
              <p className="eyebrow">Editing</p>
              <h3 className="template-title">{selectedTemplate.name}</h3>
            </div>
            <div className="template-action-row">
              <button className="btn btn-secondary" disabled={isPending} onClick={handleSave} type="button">
                {isPending ? "Working..." : "Save Template"}
              </button>
              <button
                className="btn btn-primary"
                disabled={isPending || !livePreview || livePreview.missing.length > 0 || !stageAllowed || alreadySent}
                onClick={handleTestSend}
                type="button"
              >
                {isPending ? "Working..." : alreadySent ? "Already Sent" : "Send Internal Review"}
              </button>
            </div>
          </div>

          <div className="template-grid">
            <label className="field-full">
              <span>Subject Template</span>
              <input
                className="input"
                onChange={(event) => setSubjectTemplate(event.target.value)}
                value={subjectTemplate}
              />
            </label>

            <label className="field-full">
              <span>Body Template</span>
              <textarea
                className="textarea template-textarea"
                onChange={(event) => setBodyTemplate(event.target.value)}
                value={bodyTemplate}
              />
            </label>
          </div>

          <div className="template-helper-row">
            <div className="helper">
              Sends should update workflow only through explicit effect rules, not hidden template behavior.
            </div>
            {saveMessage ? <div className="success-text">{saveMessage}</div> : null}
          </div>
          {alreadySent ? (
            <div className="helper" style={{ marginTop: "0.75rem" }}>
              This template is configured as a one-time workflow action and has already been sent for the preview buyout.
            </div>
          ) : null}
        </div>

        <div className="template-preview-grid">
          <div className="template-panel-card">
            <p className="eyebrow">Workflow Effect</p>
            <h3 className="template-title small">Send consequences</h3>
            <div className="template-effect-list">
              <div className="template-effect-row">
                <span>Allowed stages</span>
                <strong>{selectedTemplate.allowedStages.join(", ")}</strong>
              </div>
              <div className="template-effect-row">
                <span>Lifecycle change</span>
                <strong>{selectedTemplate.effectConfig.stageChange ?? "No automatic change"}</strong>
              </div>
              <div className="template-effect-row">
                <span>Next action</span>
                <strong>{selectedTemplate.effectConfig.nextAction ?? "No automatic change"}</strong>
              </div>
              <div className="template-effect-row">
                <span>Workflow steps</span>
                <strong>
                  {selectedTemplate.effectConfig.workflowKeys?.length
                    ? selectedTemplate.effectConfig.workflowKeys.join(", ")
                    : "No checklist auto-update"}
                </strong>
              </div>
              <div className="template-effect-row">
                <span>Tracking</span>
                <strong>{selectedTemplate.effectConfig.trackingHealth ?? "No automatic change"}</strong>
              </div>
              <div className="template-effect-row">
                <span>Send policy</span>
                <strong>{sendPolicyLabel(selectedTemplate)}</strong>
              </div>
            </div>
          </div>

          <div className="template-panel-card">
            <p className="eyebrow">Preview Context</p>
            <h3 className="template-title small">
              {previewBuyout ? `Previewing as ${previewBuyout.name}` : "No test buyout loaded"}
            </h3>
            {selectedPreview && livePreview ? (
              <>
                <div className="template-readiness">
                  <div className={`template-readiness-pill${livePreview.missing.length === 0 ? " ready" : " blocked"}`}>
                    {livePreview.missing.length === 0
                      ? "Ready to send"
                      : `Missing ${livePreview.missing.length} required field${livePreview.missing.length === 1 ? "" : "s"}`}
                  </div>
                  <div className="template-readiness-meta">
                    {selectedTemplate.requiredVariables.length - livePreview.missing.length}/
                    {selectedTemplate.requiredVariables.length} requirements filled
                  </div>
                </div>
                <div className={`template-stage-pill${stageAllowed ? " ready" : " blocked"}`}>
                  {previewBuyout
                    ? stageAllowed
                      ? `Allowed in ${previewBuyout.lifecycleStage}`
                      : `Blocked in ${previewBuyout.lifecycleStage}`
                    : "No test buyout loaded"}
                </div>
                {livePreview.missing.length > 0 ? (
                  <div className="template-missing-list">
                    {livePreview.missing.map((item) => (
                      <span className="template-missing-pill" key={item}>
                        {item}
                      </span>
                    ))}
                  </div>
                ) : null}

                <div className="template-preview-card">
                  <div className="template-preview-label">Rendered subject</div>
                  <div className="template-preview-subject">{livePreview.renderedSubject}</div>
                </div>

                <div className="template-preview-card">
                  <div className="template-preview-label">Rendered body</div>
                  <pre className="template-preview-body">{livePreview.renderedBody}</pre>
                </div>

                <div className="template-preview-card">
                  <div className="template-preview-label">Design preview</div>
                  <div
                    className="template-preview-frame"
                    dangerouslySetInnerHTML={{ __html: livePreview.renderedHtml }}
                  />
                </div>
              </>
            ) : (
              <div className="helper">Preview data will appear once a test buyout is available.</div>
            )}
          </div>
        </div>

        <div className="template-panel-card">
          <p className="eyebrow">Audit Trail</p>
          <h3 className="template-title small">Recent internal review activity</h3>
          <div className="template-activity-list">
            {activity.length === 0 ? (
              <div className="helper">No test sends or workflow events yet.</div>
            ) : (
              activity.map((item) => (
                <div className="template-activity-item" key={item.id}>
                  <div className="template-activity-row">
                    <strong>{item.summary}</strong>
                    <span className="template-list-meta">
                      {new Date(item.createdAt).toLocaleString("en-US", {
                        dateStyle: "medium",
                        timeStyle: "short"
                      })}
                    </span>
                  </div>
                  <div className="template-activity-meta">
                    {item.eventType}
                    {item.templateKey ? ` · ${item.templateKey.toUpperCase()}` : ""}
                    {item.mode ? ` · ${item.mode}` : ""}
                  </div>
                  {item.stageAfter || item.workflowKeys.length > 0 || item.nextAction ? (
                    <div className="template-activity-detail">
                      {item.stageAfter ? <span>Stage: {item.stageAfter}</span> : null}
                      {item.nextAction ? <span>Next: {item.nextAction}</span> : null}
                      {item.workflowKeys.length > 0 ? <span>Checklist: {item.workflowKeys.join(", ")}</span> : null}
                    </div>
                  ) : null}
                </div>
              ))
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
