"use client";

import { useState, useTransition } from "react";

import type { BuyoutSummary } from "@/lib/types";

export function BuyoutDetailEditor({ buyout }: { buyout: BuyoutSummary }) {
  const [form, setForm] = useState({
    clientName: buyout.clientName,
    clientEmail: buyout.clientEmail,
    clientPhone: buyout.clientPhone ?? "",
    eventType: buyout.eventType,
    eventDate: buyout.eventDate === "TBD" ? "" : buyout.eventDate,
    startTime: buyout.startTime ?? "",
    endTime: buyout.endTime ?? "",
    location: buyout.location,
    assignedTo: buyout.assignedTo,
    instructor: buyout.instructor,
    nextAction: buyout.nextAction,
    notes: buyout.notes,
    depositLink: buyout.depositLink ?? "",
    balanceLink: buyout.balanceLink ?? "",
    signupLink: buyout.signupLink ?? ""
  });
  const [message, setMessage] = useState("");
  const [errors, setErrors] = useState<Record<string, string[] | undefined>>({});
  const [isPending, startTransition] = useTransition();

  function updateField(key: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setErrors({});

    startTransition(async () => {
      const response = await fetch(`/api/buyouts/${buyout.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form)
      });

      const payload = (await response.json()) as {
        status: "success" | "error";
        message?: string;
        errors?: Record<string, string[] | undefined>;
      };

      if (!response.ok) {
        setErrors(payload.errors ?? {});
        setMessage(payload.message ?? "Unable to update buyout.");
        return;
      }

      setMessage(payload.message ?? "Buyout updated.");
    });
  }

  return (
    <section className="detail-card card" id="edit-event">
      <div className="detail-editor-head">
        <div>
          <h2 className="section-title" style={{ fontSize: "1.5rem", marginTop: 0 }}>
            Edit event
          </h2>
          <p className="section-copy">
            Update the operational details that feed the dashboard and email templates.
          </p>
        </div>
      </div>

      <form className="form-grid" onSubmit={handleSubmit}>
        <label className="field">
          <span>Client name</span>
          <input className="input" value={form.clientName} onChange={(event) => updateField("clientName", event.target.value)} />
          {errors.clientName ? <span className="error-text">{errors.clientName[0]}</span> : null}
        </label>
        <label className="field">
          <span>Client email</span>
          <input className="input" value={form.clientEmail} onChange={(event) => updateField("clientEmail", event.target.value)} />
          {errors.clientEmail ? <span className="error-text">{errors.clientEmail[0]}</span> : null}
        </label>
        <label className="field">
          <span>Phone</span>
          <input className="input" value={form.clientPhone} onChange={(event) => updateField("clientPhone", event.target.value)} />
        </label>
        <label className="field">
          <span>Event type</span>
          <input className="input" value={form.eventType} onChange={(event) => updateField("eventType", event.target.value)} />
        </label>
        <label className="field">
          <span>Event date</span>
          <input className="input" type="date" value={form.eventDate} onChange={(event) => updateField("eventDate", event.target.value)} />
        </label>
        <label className="field">
          <span>Location</span>
          <input className="input" value={form.location} onChange={(event) => updateField("location", event.target.value)} />
        </label>
        <label className="field">
          <span>Start time</span>
          <input className="input" value={form.startTime} onChange={(event) => updateField("startTime", event.target.value)} placeholder="2:00 PM" />
        </label>
        <label className="field">
          <span>End time</span>
          <input className="input" value={form.endTime} onChange={(event) => updateField("endTime", event.target.value)} placeholder="3:30 PM" />
        </label>
        <label className="field">
          <span>Assigned staff</span>
          <input className="input" value={form.assignedTo} onChange={(event) => updateField("assignedTo", event.target.value)} />
        </label>
        <label className="field">
          <span>Instructor</span>
          <input className="input" value={form.instructor} onChange={(event) => updateField("instructor", event.target.value)} />
        </label>
        <label className="field-full">
          <span>Next action</span>
          <input className="input" value={form.nextAction} onChange={(event) => updateField("nextAction", event.target.value)} />
        </label>
        <label className="field-full">
          <span>Deposit link</span>
          <input className="input" value={form.depositLink} onChange={(event) => updateField("depositLink", event.target.value)} />
        </label>
        <label className="field-full">
          <span>Balance link</span>
          <input className="input" value={form.balanceLink} onChange={(event) => updateField("balanceLink", event.target.value)} />
        </label>
        <label className="field-full">
          <span>Sign-up link</span>
          <input className="input" value={form.signupLink} onChange={(event) => updateField("signupLink", event.target.value)} />
        </label>
        <label className="field-full">
          <span>Team notes</span>
          <textarea
            className="textarea"
            id="buyout-notes-field"
            value={form.notes}
            onChange={(event) => updateField("notes", event.target.value)}
          />
        </label>
        <div className="detail-editor-actions field-full">
          <button className="btn btn-primary" disabled={isPending} type="submit">
            {isPending ? "Saving..." : "Save Details"}
          </button>
          {message ? <span className={message.includes("updated") ? "success-text" : "error-text"}>{message}</span> : null}
        </div>
      </form>
    </section>
  );
}
