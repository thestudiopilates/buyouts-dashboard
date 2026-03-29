export default function FeedbackPage() {
  return (
    <div style={{ maxWidth: 600, margin: "0 auto", padding: "80px 24px", fontFamily: "'DM Sans', Helvetica, sans-serif", color: "#28200E" }}>
      <div style={{ textAlign: "center", marginBottom: 32 }}>
        <div style={{ fontFamily: "Georgia, serif", fontSize: "2rem", fontWeight: 700, color: "#28200E", marginBottom: 8 }}>
          How Was Your Buyout?
        </div>
        <div style={{ fontSize: "1rem", color: "#7A6F64", lineHeight: 1.6 }}>
          We'd love to hear about your experience at The Studio Pilates. Your feedback helps us make every private event even better.
        </div>
      </div>

      <div style={{ background: "#F7F3EF", borderRadius: 14, padding: 32, marginBottom: 24 }}>
        <div style={{ fontSize: "0.85rem", color: "#7A6F64", textAlign: "center", lineHeight: 1.6 }}>
          Our feedback form is coming soon. In the meantime, reply to your last email from us or reach out to{" "}
          <a href="mailto:events@thestudiopilates.com" style={{ color: "#006976", fontWeight: 600 }}>
            events@thestudiopilates.com
          </a>{" "}
          and let us know how it went. We read every response.
        </div>
      </div>

      <div style={{ textAlign: "center" }}>
        <a
          href="https://thestudiopilates.com"
          style={{ color: "#9F543F", fontWeight: 600, fontSize: "0.9rem", textDecoration: "none" }}
        >
          Back to The Studio Pilates
        </a>
      </div>
    </div>
  );
}
