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

async function momenceFetch(endpoint: string, params: Record<string, string> = {}) {
  const url = new URL(`${MOMENCE_BASE}/${endpoint}`);
  url.searchParams.set("hostId", MOMENCE_HOST_ID);
  url.searchParams.set("token", MOMENCE_TOKEN);

  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  const response = await fetch(url.toString(), {
    headers: { Accept: "application/json" },
    next: { revalidate: 300 }
  });

  if (!response.ok) {
    throw new Error(`Momence API error: ${response.status}`);
  }

  return response.json();
}

export async function getMomenceClassByUrl(signupUrl: string): Promise<MomenceClassInfo | null> {
  if (!signupUrl) return null;

  // Extract class ID from Momence URL patterns:
  // https://momence.com/l/4ZhnW48O or https://momence.com/m/63279
  const shortMatch = signupUrl.match(/momence\.com\/l\/([A-Za-z0-9]+)/);
  const idMatch = signupUrl.match(/momence\.com\/m\/(\d+)/);

  if (!shortMatch && !idMatch) return null;

  try {
    // Fetch upcoming events and find the matching one
    const data = await momenceFetch("Events") as { data?: Array<Record<string, unknown>> } | Array<Record<string, unknown>>;
    const events = Array.isArray(data) ? data : (data.data ?? []);

    // For short links, we need to match by checking each event
    // For direct IDs, we can match by sessionId
    const classId = idMatch?.[1];

    let matchedEvent: Record<string, unknown> | null = null;

    for (const event of events) {
      if (classId && String(event.sessionId ?? event.id) === classId) {
        matchedEvent = event;
        break;
      }

      // Check if the event URL matches
      const eventUrl = String(event.signUpUrl ?? event.link ?? "");
      if (eventUrl && signupUrl.includes(eventUrl.split("/").pop() ?? "NOMATCH")) {
        matchedEvent = event;
        break;
      }
    }

    if (!matchedEvent) return null;

    // Fetch attendees for this event
    const eventId = String(matchedEvent.sessionId ?? matchedEvent.id);
    let attendees: MomenceAttendee[] = [];

    try {
      const attendeeData = await momenceFetch(`Events/${eventId}/attendees`) as
        | { data?: Array<Record<string, unknown>> }
        | Array<Record<string, unknown>>;

      const rawAttendees = Array.isArray(attendeeData) ? attendeeData : (attendeeData.data ?? []);

      attendees = rawAttendees.map((a) => ({
        id: String(a.id ?? a.userId ?? ""),
        firstName: String(a.firstName ?? a.first_name ?? ""),
        lastName: String(a.lastName ?? a.last_name ?? ""),
        email: String(a.email ?? ""),
        waiverSigned: Boolean(a.waiverSigned ?? a.waiver_signed ?? false)
      }));
    } catch {
      // Attendee fetch failed — return class info without attendees
    }

    return {
      id: eventId,
      name: String(matchedEvent.name ?? matchedEvent.title ?? ""),
      startDate: String(matchedEvent.startDate ?? matchedEvent.start ?? ""),
      endDate: String(matchedEvent.endDate ?? matchedEvent.end ?? ""),
      maxCapacity: Number(matchedEvent.maxCapacity ?? matchedEvent.capacity ?? 0),
      signupCount: attendees.length || Number(matchedEvent.signupCount ?? matchedEvent.attendeeCount ?? 0),
      attendees
    };
  } catch {
    return null;
  }
}
