"use client";

import { FormEvent, useState } from "react";

import type { InquiryFormState } from "@/lib/validations";

const initialState: InquiryFormState = { status: "idle" };

export function InquiryForm() {
  const [state, setState] = useState<InquiryFormState>(initialState);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setState(initialState);
    const formData = new FormData(event.currentTarget);

    const response = await fetch("/api/inquiries", {
      method: "POST",
      body: formData
    });

    const result = (await response.json()) as InquiryFormState;
    setState(result);
    setIsSubmitting(false);

    if (response.ok) {
      event.currentTarget.reset();
    }
  }

  return (
    <div className="form-card card">
      <h2 className="section-title" style={{ fontSize: "2rem", marginTop: 0 }}>
        Start a private event inquiry
      </h2>
      <p className="section-copy">
        This form is the front door into the new buyouts platform. It feeds directly into the
        internal dashboard rather than Monday.
      </p>

      <form className="form-grid" onSubmit={handleSubmit}>
        <label className="field">
          <span>Name</span>
          <input className="input" name="clientName" placeholder="Sarah Chen" required />
          {state.errors?.clientName ? <span className="error-text">{state.errors.clientName[0]}</span> : null}
        </label>

        <label className="field">
          <span>Email</span>
          <input className="input" type="email" name="clientEmail" placeholder="sarah@example.com" required />
          {state.errors?.clientEmail ? <span className="error-text">{state.errors.clientEmail[0]}</span> : null}
        </label>

        <label className="field">
          <span>Phone</span>
          <input className="input" name="clientPhone" placeholder="(404) 555-0112" />
        </label>

        <label className="field">
          <span>Company or group</span>
          <input className="input" name="companyName" placeholder="Acme Team Offsite" />
        </label>

        <label className="field">
          <span>Event type</span>
          <select className="select" name="eventType" defaultValue="">
            <option value="">Select an option</option>
            <option value="Birthday">Birthday</option>
            <option value="Corporate">Corporate</option>
            <option value="Bachelorette">Bachelorette</option>
            <option value="Team Building">Team Building</option>
            <option value="Other">Other</option>
          </select>
        </label>

        <label className="field">
          <span>Estimated guest count</span>
          <input className="input" type="number" min="1" name="guestCountEstimate" placeholder="20" />
        </label>

        <label className="field">
          <span>Preferred location</span>
          <select className="select" name="preferredLocation" defaultValue="">
            <option value="">Select a studio</option>
            <option value="1583 Decatur">1583 Decatur</option>
            <option value="1581 Decatur">1581 Decatur</option>
            <option value="763 Trabert">763 Trabert</option>
            <option value="Flexible">Flexible</option>
          </select>
        </label>

        <label className="field">
          <span>Preferred dates</span>
          <input className="input" name="preferredDates" placeholder="April 12, 15, or 18 after 2 PM" />
        </label>

        <label className="field-full">
          <span>Notes</span>
          <textarea
            className="textarea"
            name="notes"
            placeholder="Share the occasion, goals, and anything the team should know."
          />
        </label>

        <div className="field-full" style={{ gap: "0.75rem" }}>
          <button className="btn btn-primary" disabled={isSubmitting} type="submit">
            {isSubmitting ? "Submitting..." : "Submit Inquiry"}
          </button>
          <span className="helper">
            New inquiries will later trigger notifications, assignment rules, and follow-up workflows.
          </span>
          {state.status === "success" ? <span className="success-text">{state.message}</span> : null}
          {state.status === "error" && state.message ? <span className="error-text">{state.message}</span> : null}
        </div>
      </form>
    </div>
  );
}
