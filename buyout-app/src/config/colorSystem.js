/**
 * COLOR SYSTEM & URGENCY LOGIC
 *
 * Brand palette for The Studio Pilates.
 * Typography: Playfair Display (Moret stand-in), DM Sans (Adelle Sans stand-in)
 *
 * Urgency encoding:
 *   Green family (seaglass/sky/sage) = healthy / on track / done
 *   Yellow family (sunshine/apricot) = watch / moderate concern
 *   Red family (terracotta/cherry)   = urgent / action needed
 */

// ── Brand Palette ─────────────────────────────────────────────────
export const COLORS = {
  coffee:         '#28200E',  // Primary text, nav bar
  oat:            '#EEE2D9',  // Light surfaces, table header
  oatLight:       '#F7F3EF',  // Alternating row bg, card backgrounds
  seaglass:       '#006976',  // Positive: on track, TSP team, paid
  sky:            '#A1B1A4',  // Complete, secondary positive
  sage:           '#797F5D',  // Moderate positive: 70%+ fill
  sunshine:       '#F2A408',  // Warning: 7-13 days, getting close
  apricot:        '#E0800E',  // Elevated warning: running behind
  terracotta:     '#9F543F',  // Brand accent, client BIC, 4-6 days
  cherry:         '#E8581B',  // Urgent: 0-3 days, major issue
  white:          '#FFFFFF',
  warmGrey:       '#B5AA9F',  // Muted text, disabled states
  divider:        '#E0D6CC',  // Borders, separators
  bg:             '#F4EDE7',  // Page background
  card:           '#FEFCFA',  // Card background
  terracottaLight:'#F5EBE7',  // Selected row highlight
};

// ── Typography ────────────────────────────────────────────────────
export const FONTS = {
  heading: "'Playfair Display', Georgia, serif",
  body:    "'DM Sans', 'Segoe UI', sans-serif",
};

// ── Countdown Circle Colors ───────────────────────────────────────
// Based on days until event (date_mkzjkm1t).
// Returns { bg, fg } for the countdown circle.
export function getCountdownColor(daysOut) {
  if (daysOut === null || daysOut === undefined) {
    return { bg: COLORS.warmGrey + '22', fg: COLORS.warmGrey };
  }
  if (daysOut < 0) {
    return { bg: COLORS.warmGrey + '22', fg: COLORS.warmGrey };
  }
  if (daysOut <= 3) {
    return { bg: COLORS.cherry, fg: COLORS.white }; // + box-shadow glow
  }
  if (daysOut <= 6) {
    return { bg: COLORS.terracotta, fg: COLORS.white };
  }
  if (daysOut <= 13) {
    return { bg: COLORS.sunshine, fg: COLORS.coffee };
  }
  return { bg: COLORS.seaglass, fg: COLORS.white };
}

// ── Status Badge Color ────────────────────────────────────────────
// Colors the "Where Are We Now" label based on "How's it Tracking?"
export function getStatusColor(trackingStatus) {
  switch (trackingStatus) {
    case 'So far so good': return COLORS.seaglass;
    case 'Running behind': return COLORS.apricot;
    case 'Major issue':    return COLORS.cherry;
    case 'Complete':       return COLORS.sky;
    default:               return COLORS.coffee;
  }
}

// ── Ball In Court Color ───────────────────────────────────────────
export function getBallInCourtColor(bic) {
  switch (bic) {
    case 'TSP Team': return COLORS.seaglass;
    case 'Client':   return COLORS.terracotta;
    case 'Both':     return COLORS.sage;
    default:         return COLORS.warmGrey;
  }
}

// ── Days Waiting Urgency ──────────────────────────────────────────
// Colors the "Next Action" text.
export function getDaysWaitingColor(daysWaiting) {
  if (daysWaiting > 5) return COLORS.cherry;
  if (daysWaiting > 2) return COLORS.apricot;
  return COLORS.seaglass;
}

// ── Sign-Up Fill Color ────────────────────────────────────────────
export function getSignupFillColor(percentage) {
  if (percentage >= 100) return COLORS.seaglass;
  if (percentage >= 70)  return COLORS.sage;
  if (percentage >= 50)  return COLORS.sunshine;
  return COLORS.cherry;
}

// ── Workflow Progress Color ───────────────────────────────────────
export function getWorkflowColor(percentage) {
  if (percentage >= 100) return COLORS.seaglass;
  if (percentage >= 50)  return COLORS.sage;
  return COLORS.warmGrey;
}

// ── Event Type Badge ──────────────────────────────────────────────
export function getEventTypeStyle(type) {
  switch (type) {
    case 'Birthday':     return { bg: COLORS.sunshine + '1A',    fg: COLORS.sunshine };
    case 'Corporate':    return { bg: COLORS.seaglass + '1A',    fg: COLORS.seaglass };
    case 'Bachelorette': return { bg: COLORS.terracotta + '1A',  fg: COLORS.terracotta };
    default:             return { bg: COLORS.sage + '1A',        fg: COLORS.sage };
  }
}
