"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

type BuyoutInfo = {
  id: string;
  name: string;
  eventDate: string | null;
  location: string | null;
  clientName: string | null;
  clientEmail: string | null;
};

type ExistingFeedback = {
  id: string;
  rating: number | null;
  experienceText: string | null;
  instructorRating: number | null;
  venueRating: number | null;
  wouldRecommend: boolean | null;
  highlights: string | null;
  improvements: string | null;
  clientName: string | null;
  clientEmail: string | null;
  isSubmitted: boolean;
};

function StarRating({
  value,
  onChange,
  label
}: {
  value: number | null;
  onChange: (v: number) => void;
  label: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ fontSize: "0.85rem", fontWeight: 600, color: "#28200E", marginBottom: 8 }}>{label}</div>
      <div style={{ display: "flex", gap: 6 }}>
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => onChange(star)}
            onMouseEnter={() => setHover(star)}
            onMouseLeave={() => setHover(null)}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              fontSize: "1.8rem",
              color: (hover ?? value ?? 0) >= star ? "#F2A408" : "#E0D6CC",
              transition: "color 0.15s",
              padding: "2px 1px",
              lineHeight: 1
            }}
            aria-label={`${star} star${star > 1 ? "s" : ""}`}
          >
            ★
          </button>
        ))}
      </div>
    </div>
  );
}

export default function FeedbackPageWrapper() {
  return (
    <Suspense fallback={<div style={{ maxWidth: 560, margin: "0 auto", padding: "100px 20px", textAlign: "center", fontFamily: "'DM Sans', Helvetica, sans-serif", color: "#7A6F64" }}>Loading...</div>}>
      <FeedbackPage />
    </Suspense>
  );
}

function FeedbackPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [buyout, setBuyout] = useState<BuyoutInfo | null>(null);
  const [alreadySubmitted, setAlreadySubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const [rating, setRating] = useState<number | null>(null);
  const [experienceText, setExperienceText] = useState("");
  const [instructorRating, setInstructorRating] = useState<number | null>(null);
  const [venueRating, setVenueRating] = useState<number | null>(null);
  const [wouldRecommend, setWouldRecommend] = useState<boolean | null>(null);
  const [highlights, setHighlights] = useState("");
  const [improvements, setImprovements] = useState("");
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");

  useEffect(() => {
    if (!token) {
      setError("Missing feedback token. Please use the link from your email.");
      setLoading(false);
      return;
    }

    fetch(`/api/feedback?token=${encodeURIComponent(token)}`)
      .then((res) => res.json())
      .then((data: { error?: string; buyout?: BuyoutInfo; feedback?: ExistingFeedback | null }) => {
        if (data.error) {
          setError(data.error);
        } else if (data.buyout) {
          setBuyout(data.buyout);
          if (data.buyout.clientName) setClientName(data.buyout.clientName);
          if (data.buyout.clientEmail) setClientEmail(data.buyout.clientEmail);

          if (data.feedback?.isSubmitted) {
            setAlreadySubmitted(true);
            setRating(data.feedback.rating);
            setExperienceText(data.feedback.experienceText ?? "");
            setInstructorRating(data.feedback.instructorRating);
            setVenueRating(data.feedback.venueRating);
            setWouldRecommend(data.feedback.wouldRecommend);
            setHighlights(data.feedback.highlights ?? "");
            setImprovements(data.feedback.improvements ?? "");
            if (data.feedback.clientName) setClientName(data.feedback.clientName);
            if (data.feedback.clientEmail) setClientEmail(data.feedback.clientEmail);
          }
        }
        setLoading(false);
      })
      .catch(() => {
        setError("Unable to load feedback form. Please try again.");
        setLoading(false);
      });
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !rating) return;
    setSubmitting(true);

    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          rating,
          experienceText: experienceText.trim() || null,
          instructorRating,
          venueRating,
          wouldRecommend,
          highlights: highlights.trim() || null,
          improvements: improvements.trim() || null,
          clientName: clientName.trim() || null,
          clientEmail: clientEmail.trim() || null
        })
      });

      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (data.ok) {
        setSubmitted(true);
      } else {
        setError(data.error ?? "Unable to submit feedback.");
      }
    } catch {
      setError("Unable to submit feedback. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const containerStyle: React.CSSProperties = {
    maxWidth: 560,
    margin: "0 auto",
    padding: "60px 20px 80px",
    fontFamily: "'DM Sans', Helvetica, sans-serif",
    color: "#28200E"
  };

  const headingStyle: React.CSSProperties = {
    fontFamily: "Georgia, serif",
    fontSize: "1.75rem",
    fontWeight: 700,
    color: "#28200E",
    marginBottom: 6,
    textAlign: "center"
  };

  const subtitleStyle: React.CSSProperties = {
    fontSize: "0.92rem",
    color: "#7A6F64",
    lineHeight: 1.6,
    textAlign: "center",
    marginBottom: 32
  };

  const cardStyle: React.CSSProperties = {
    background: "#FEFCFA",
    border: "1px solid #E0D6CC",
    borderRadius: 14,
    padding: "28px 24px",
    marginBottom: 20
  };

  const labelStyle: React.CSSProperties = {
    display: "block",
    fontSize: "0.85rem",
    fontWeight: 600,
    color: "#28200E",
    marginBottom: 8
  };

  const textareaStyle: React.CSSProperties = {
    width: "100%",
    border: "1px solid #E0D6CC",
    borderRadius: 10,
    padding: "10px 14px",
    fontSize: "0.88rem",
    fontFamily: "'DM Sans', Helvetica, sans-serif",
    color: "#28200E",
    background: "#F7F3EF",
    resize: "vertical",
    minHeight: 80,
    lineHeight: 1.5
  };

  const inputStyle: React.CSSProperties = {
    ...textareaStyle,
    minHeight: "unset",
    resize: "none"
  };

  const btnStyle: React.CSSProperties = {
    display: "block",
    width: "100%",
    background: "#006976",
    color: "#fff",
    border: "none",
    borderRadius: 10,
    padding: "14px 24px",
    fontSize: "0.95rem",
    fontWeight: 600,
    cursor: "pointer",
    fontFamily: "'DM Sans', Helvetica, sans-serif",
    marginTop: 8
  };

  if (loading) {
    return (
      <div style={containerStyle}>
        <div style={{ ...subtitleStyle, marginTop: 80 }}>Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={containerStyle}>
        <div style={headingStyle}>Oops</div>
        <div style={{ ...subtitleStyle, color: "#9F543F" }}>{error}</div>
        <div style={{ textAlign: "center" }}>
          <a href="https://thestudiopilates.com" style={{ color: "#9F543F", fontWeight: 600, fontSize: "0.9rem", textDecoration: "none" }}>
            Back to The Studio Pilates
          </a>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div style={containerStyle}>
        <div style={{ textAlign: "center", padding: "40px 0" }}>
          <div style={{ fontSize: "2.5rem", marginBottom: 12 }}>&#10024;</div>
          <div style={headingStyle}>Thank You!</div>
          <div style={subtitleStyle}>
            Your feedback means the world to us. We read every response and use it to make our private events even better.
          </div>
          <a href="https://thestudiopilates.com" style={{ ...btnStyle, display: "inline-block", width: "auto", background: "#9F543F", textDecoration: "none" }}>
            Back to The Studio Pilates
          </a>
        </div>
      </div>
    );
  }

  if (alreadySubmitted) {
    return (
      <div style={containerStyle}>
        <div style={{ textAlign: "center", padding: "40px 0" }}>
          <div style={{ fontSize: "2.5rem", marginBottom: 12 }}>&#9989;</div>
          <div style={headingStyle}>Already Submitted</div>
          <div style={subtitleStyle}>
            We already received your feedback for {buyout?.name ?? "this event"}. Thank you so much!
          </div>
          <a href="https://thestudiopilates.com" style={{ ...btnStyle, display: "inline-block", width: "auto", background: "#9F543F", textDecoration: "none" }}>
            Back to The Studio Pilates
          </a>
        </div>
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      <div style={headingStyle}>How Was Your Event?</div>
      <div style={subtitleStyle}>
        {buyout?.name ? (
          <>We&apos;d love to hear about <strong>{buyout.name}</strong>{buyout.location ? ` at ${buyout.location}` : ""}.</>
        ) : (
          <>We&apos;d love to hear about your experience at The Studio Pilates.</>
        )}
        {" "}Your feedback helps us make every private event even better.
      </div>

      <form onSubmit={handleSubmit}>
        <div style={cardStyle}>
          <StarRating label="Overall Experience" value={rating} onChange={setRating} />
          <StarRating label="Instructor Quality" value={instructorRating} onChange={setInstructorRating} />
          <StarRating label="Venue & Setup" value={venueRating} onChange={setVenueRating} />
        </div>

        <div style={cardStyle}>
          <label style={labelStyle}>Tell us about your experience</label>
          <textarea
            style={textareaStyle}
            placeholder="How was the session? What stood out?"
            value={experienceText}
            onChange={(e) => setExperienceText(e.target.value)}
            rows={3}
          />
        </div>

        <div style={cardStyle}>
          <label style={labelStyle}>What were the highlights?</label>
          <textarea
            style={textareaStyle}
            placeholder="Anything that made the event special..."
            value={highlights}
            onChange={(e) => setHighlights(e.target.value)}
            rows={2}
          />

          <label style={{ ...labelStyle, marginTop: 16 }}>Anything we could improve?</label>
          <textarea
            style={textareaStyle}
            placeholder="We appreciate honest feedback..."
            value={improvements}
            onChange={(e) => setImprovements(e.target.value)}
            rows={2}
          />
        </div>

        <div style={cardStyle}>
          <div style={{ ...labelStyle, marginBottom: 12 }}>Would you recommend us to a friend?</div>
          <div style={{ display: "flex", gap: 10 }}>
            {([true, false] as const).map((val) => (
              <button
                key={String(val)}
                type="button"
                onClick={() => setWouldRecommend(val)}
                style={{
                  flex: 1,
                  padding: "10px 16px",
                  borderRadius: 10,
                  border: `2px solid ${wouldRecommend === val ? (val ? "#006976" : "#9F543F") : "#E0D6CC"}`,
                  background: wouldRecommend === val ? (val ? "rgba(0,105,118,0.08)" : "rgba(159,84,63,0.08)") : "#F7F3EF",
                  color: wouldRecommend === val ? (val ? "#006976" : "#9F543F") : "#7A6F64",
                  fontSize: "0.88rem",
                  fontWeight: 600,
                  cursor: "pointer",
                  fontFamily: "'DM Sans', Helvetica, sans-serif",
                  transition: "all 0.15s"
                }}
              >
                {val ? "Absolutely!" : "Not yet"}
              </button>
            ))}
          </div>
        </div>

        <div style={cardStyle}>
          <label style={labelStyle}>Your Name</label>
          <input
            style={inputStyle}
            type="text"
            placeholder="First and last name"
            value={clientName}
            onChange={(e) => setClientName(e.target.value)}
          />
          <label style={{ ...labelStyle, marginTop: 14 }}>Email</label>
          <input
            style={inputStyle}
            type="email"
            placeholder="your@email.com"
            value={clientEmail}
            onChange={(e) => setClientEmail(e.target.value)}
          />
        </div>

        <button
          type="submit"
          disabled={submitting || !rating}
          style={{
            ...btnStyle,
            opacity: submitting || !rating ? 0.55 : 1
          }}
        >
          {submitting ? "Submitting..." : "Submit Feedback"}
        </button>

        {!rating && (
          <div style={{ textAlign: "center", fontSize: "0.8rem", color: "#B5AA9F", marginTop: 8 }}>
            Please rate your overall experience to submit
          </div>
        )}
      </form>

      <div style={{ textAlign: "center", marginTop: 28 }}>
        <a href="https://thestudiopilates.com" style={{ color: "#9F543F", fontWeight: 600, fontSize: "0.85rem", textDecoration: "none" }}>
          Back to The Studio Pilates
        </a>
      </div>
    </div>
  );
}
