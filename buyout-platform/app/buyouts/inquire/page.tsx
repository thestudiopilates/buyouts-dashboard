import Link from "next/link";

import { InquiryForm } from "@/components/inquiry-form";
import { SiteHeader } from "@/components/site-header";

export default function BuyoutInquiryPage() {
  return (
    <div className="shell">
      <SiteHeader />
      <main className="hero">
        <div className="container hero-grid">
          <section className="hero-card">
            <span className="eyebrow">Public intake</span>
            <h1>Collect buyout inquiries directly from your website.</h1>
            <p>
              This replaces the old board-first intake flow. New submissions can feed straight into
              your internal dashboard, assignment rules, and email workflows.
            </p>
            <div className="hero-actions">
              <Link className="btn btn-secondary" href="/dashboard">
                Preview internal dashboard
              </Link>
            </div>
          </section>
          <InquiryForm />
        </div>
      </main>
    </div>
  );
}
