const MOMENCE_HOST_ID = process.env.MOMENCE_HOST_ID ?? "29863";
const MOMENCE_TOKEN = process.env.MOMENCE_TOKEN ?? "090989e2fd";
const MOMENCE_BASE = `https://momence.com/_api/primary/api/v1`;

export type MomenceAttendee = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  waiverSigned: boolean;
};

export type MomenceClassInfo = {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  maxCapacity: number;
  signupCount: number;
  attendees: MomenceAttendee[];
};

async function momenceFetch(endpoint: string) {
  const url = new URL(`${MOMENCE_BASE}/${endpoint}`);
  url.searchParams.set("hostId", MOMENCE_HOST_ID);
  url.searchParams.set("token", MOMENCE_TOKEN);

  const response = await fetch(url.toString(), {
    headers: { Accept: "application/json" },
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(`Momence API error ${response.status} for ${endpoint}`);
  }

  return response.json();
}

// Resolve a short link (momence.com/l/slug) to a direct event ID.
// The redirect lands on a slug path like /Host-Name/Event-Title/132559426 —
// the numeric ID is always the last path segment.
async function resolveShortLinkToEventId(slug: string): Promise<string | null> {
  try {
    const response = await fetch(`https://momence.com/l/${slug}`, {
      method: "HEAD",
      redirect: "follow",
      headers: { "User-Agent": "Mozilla/5.0" }
    });
    // Final URL is something like /The-Studio-Pilates/Event-Name/132559426
    const segments = response.url.split("/").filter(Boolean);
    const last = segments[segments.length - 1];
    return /^\d+$/.test(last) ? last : null;
  } catch {
    return null;
  }
}

// Parse a Momence signup URL to a numeric event ID.
// Handles: /s/{id}, /m/{id} (legacy), and /l/{slug} (short links).
export async function resolveSignupLinkToEventId(signupUrl: string): Promise<string | null> {
  if (!signupUrl) return null;

  // Direct numeric IDs: momence.com/s/132559426 or momence.com/m/63279
  const directMatch = signupUrl.match(/momence\.com\/[sm]\/(\d+)/);
  if (directMatch) return directMatch[1];

  // Short link: momence.com/l/4ZhnW48O — follow redirect for real ID
  const shortMatch = signupUrl.match(/momence\.com\/l\/([A-Za-z0-9]+)/);
  if (shortMatch) return resolveShortLinkToEventId(shortMatch[1]);

  return null;
}

// Surgical fetch: one call to GET /Events/{id}, no bulk listing.
// The API returns an array — we take the first element.
// Signup count comes from ticketsSold on the event object directly.
export async function getMomenceEventById(eventId: string): Promise<MomenceClassInfo | null> {
  try {
    const raw = await momenceFetch(`Events/${eventId}`) as
      | Record<string, unknown>
      | Array<Record<string, unknown>>;

    const event: Record<string, unknown> = Array.isArray(raw) ? raw[0] : raw;
    if (!event) return null;

    return {
      id: String(event.id ?? eventId),
      name: String(event.title ?? event.name ?? ""),
      startDate: String(event.dateTime ?? event.startDate ?? ""),
      endDate: String(event.endDate ?? ""),
      maxCapacity: Number(event.capacity ?? event.maxCapacity ?? 0),
      // ticketsSold is the authoritative count from Momence
      signupCount: Number(event.ticketsSold ?? event.signupCount ?? event.attendeeCount ?? 0),
      attendees: [] // attendees list not needed for count-only sync
    };
  } catch {
    return null;
  }
}

// Convenience wrapper: resolve the signup URL then fetch directly.
export async function getMomenceClassByUrl(signupUrl: string): Promise<MomenceClassInfo | null> {
  const eventId = await resolveSignupLinkToEventId(signupUrl);
  if (!eventId) return null;
  return getMomenceEventById(eventId);
}
