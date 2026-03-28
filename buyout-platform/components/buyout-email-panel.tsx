"use client";

import { useMemo, useState, useTransition } from "react";

import type { EmailActivityRecord, EmailTemplatePreview, EmailTemplateRecord } from "@/lib/email-templates";
import type { GmailReadiness } from "@/lib/gmail";
import type { BuyoutSummary } from "@/lib/types";

function formatTimestamp(value: string) {
  return new Date(value).toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short"
  });
}

function effectLabel(template: EmailTemplateRecord) {
  if (template.effectConfig.stageChange) {
    return `Moves to ${template.effectConfig.stageChange}`;
  }

  if (template.effectConfig.trackingHealth) {
    return `Sets health to ${template.effectConfig.trackingHealth}`;
  }

  return "Informational only";
}

function isSingleSendTemplate(template: EmailTemplateRecord) {
  return (template.effectConfig.sendPolicy ?? "repeatable") === "single";
}

function sendPolicyLabel(template: EmailTemplateRecord) {
  return isSingleSendTemplate(template) ? "One-time workflow action" : "Repeatable follow-up";
}

export function BuyoutEmailPanel({
  buyout,
  templates,
  previews,
  activity,
  gmail
}: {
  buyout: BuyoutSummary;
  templates: EmailTemplateRecord[];
  previews: EmailTemplatePreview[];
  activity: EmailActivityRecord[];
  gmail: GmailReadiness;
}) {
  const [panelBuyout, setPanelBuyout] = useState(buyout);
  const [panelActivity, setPanelActivity] = useState(activity);
  const [message, setMessage] = useState("");
  const [pendingKey, setPendingKey] = useState("");
  const [isPending, startTransition] = useTransition();

  const previewMap = useMemo(
    () => new Map(previews.map((preview) => [preview.key, preview])),
    [previews]
  );

  function sendTest(templateKey: string) {
    setMessage("");
    setPendingKey(templateKey);

    startTransition(async () => {
      const response = await fetch(`/api/email-templates/${templateKey}/test-send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ buyoutId: panelBuyout.id })
      });

      const payload = (await response.json()) as {
        message?: string;
        error?: string;
        activity?: EmailActivityRecord[];
        buyout?: BuyoutSummary;
      };

      if (!response.ok) {
        setMessage(payload.error ?? "Unable to run the internal review send.");
        setPendingKey("");
        return;
      }

      if (payload.activity) {
        setPanelActivity(payload.activity);
      }

      if (payload.buyout) {
        setPanelBuyout(payload.buyout);
      }

      setMessage(payload.message ?? "Internal review send completed.");
      setPendingKey("");
    });
  }

  return (
    <section className="detail-card card">
      <div className="buyout-email-head">
        <div>
          <h2 className="section-title" style={{ fontSize: "1.5rem", marginTop: 0 }}>
            Email operations
          </h2>
          <p className="section-copy">
            Preview readiness, send internal review emails for this buyout, and review workflow effects and audit history.
          </p>
        </div>
        <div className={`buyout-email-mode${gmail.ready ? " ready" : " blocked"}`}>
          {gmail.ready ? `Live Gmail via ${gmail.senderEmail}` : "Simulated mode until Gmail is connected"}
        </div>
      </div>

      {message ? <div className="buyout-email-message">{message}</div> : null}

      <div className="buyout-email-grid">
        <div className="buyout-email-stack">
          {templates.map((template) => {
            const preview = previewMap.get(template.key);
            const missing = preview?.missingVariables ?? [];
            const sent = panelBuyout.sentTemplateIds.includes(template.key);
            const allowed = template.allowedStages.includes(panelBuyout.lifecycleStage);
            const alreadyComplete = sent && isSingleSendTemplate(template);
            const blocked = missing.length > 0 || !allowed || alreadyComplete;

            return (
              <div className="buyout-email-card" key={template.key}>
                <div className="buyout-email-card-head">
                  <div>
                    <div className="buyout-email-title">
                      {template.key.toUpperCase()} · {template.name}
                    </div>
                    <div className="buyout-email-meta">
                    {template.triggerLabel} · {effectLabel(template)}
                  </div>
                </div>
                  <div className={`buyout-email-state${sent ? " sent" : blocked ? " blocked" : " ready"}`}>
                    {sent ? "Sent" : blocked ? "Blocked" : "Ready"}
                  </div>
                </div>

                <div className="buyout-email-chip-row">
                  <span className={`buyout-email-chip${allowed ? " ready" : " blocked"}`}>
                    {allowed ? `Allowed in ${panelBuyout.lifecycleStage}` : `Blocked in ${panelBuyout.lifecycleStage}`}
                  </span>
                  <span className={`buyout-email-chip${missing.length === 0 ? " ready" : " blocked"}`}>
                    {missing.length === 0 ? "All required fields present" : `${missing.length} fields missing`}
                  </span>
                  <span className="buyout-email-chip ready">{sendPolicyLabel(template)}</span>
                  <span className={`buyout-email-chip${alreadyComplete ? " blocked" : " ready"}`}>
                    {alreadyComplete ? "One-time action already sent" : "Send action available"}
                  </span>
                </div>

                {missing.length > 0 ? (
                  <div className="buyout-email-missing">Missing: {missing.join(", ")}</div>
                ) : null}
                {alreadyComplete ? (
                  <div className="buyout-email-missing">
                    This is a one-time workflow email and has already been recorded for this buyout.
                  </div>
                ) : null}

                <div className="buyout-email-subject">{preview?.renderedSubject ?? template.subjectTemplate}</div>
                {preview ? (
                  <div
                    className="buyout-email-preview"
                    dangerouslySetInnerHTML={{ __html: preview.renderedHtml }}
                  />
                ) : null}
                <div className="buyout-email-actions">
                  <button
                    className="btn btn-primary"
                    disabled={isPending || blocked}
                    onClick={() => sendTest(template.key)}
                    type="button"
                  >
                    {pendingKey === template.key
                      ? "Sending..."
                      : alreadyComplete
                        ? "Already Sent"
                        : "Send Internal Review"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <div className="buyout-email-history">
          <div className="buyout-email-history-head">
            <div className="metric-label">Recent activity</div>
            <strong>{panelActivity.length}</strong>
          </div>
          {panelActivity.length === 0 ? (
            <div className="helper">No email activity recorded for this buyout yet.</div>
          ) : (
            <div className="buyout-email-history-list">
              {panelActivity.map((item) => (
                <div className="buyout-email-history-item" key={item.id}>
                  <div className="buyout-email-history-top">
                    <strong>{item.summary}</strong>
                    <span className="buyout-email-history-time">{formatTimestamp(item.createdAt)}</span>
                  </div>
                  <div className="buyout-email-history-meta">
                    {item.eventType}
                    {item.templateKey ? ` · ${item.templateKey.toUpperCase()}` : ""}
                    {item.mode ? ` · ${item.mode}` : ""}
                  </div>
                  {item.stageAfter || item.nextAction ? (
                    <div className="buyout-email-history-detail">
                      {item.stageAfter ? <span>Stage: {item.stageAfter}</span> : null}
                      {item.nextAction ? <span>Next: {item.nextAction}</span> : null}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
