type GmailConfig = {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  senderEmail: string;
  userId: string;
  subjectPrefix: string;
};

export type GmailReadiness = {
  ready: boolean;
  senderEmail: string | null;
  missing: string[];
  mode: "gmail" | "simulated";
};

export type GmailSendResult = {
  messageId: string;
  threadId: string;
};

function getGmailConfig(): GmailConfig | null {
  const clientId = process.env.GMAIL_CLIENT_ID;
  const clientSecret = process.env.GMAIL_CLIENT_SECRET;
  const refreshToken = process.env.GMAIL_REFRESH_TOKEN;
  const senderEmail = process.env.GMAIL_SENDER_EMAIL;

  if (!clientId || !clientSecret || !refreshToken || !senderEmail) {
    return null;
  }

  return {
    clientId,
    clientSecret,
    refreshToken,
    senderEmail,
    userId: process.env.GMAIL_USER_ID || "me",
    subjectPrefix: process.env.GMAIL_TEST_SUBJECT_PREFIX || "[TSP Test]"
  };
}

export function getGmailReadiness(): GmailReadiness {
  const missing = [
    !process.env.GMAIL_CLIENT_ID ? "GMAIL_CLIENT_ID" : null,
    !process.env.GMAIL_CLIENT_SECRET ? "GMAIL_CLIENT_SECRET" : null,
    !process.env.GMAIL_REFRESH_TOKEN ? "GMAIL_REFRESH_TOKEN" : null,
    !process.env.GMAIL_SENDER_EMAIL ? "GMAIL_SENDER_EMAIL" : null
  ].filter((item): item is string => Boolean(item));

  return {
    ready: missing.length === 0,
    senderEmail: process.env.GMAIL_SENDER_EMAIL ?? null,
    missing,
    mode: missing.length === 0 ? "gmail" : "simulated"
  };
}

async function getAccessToken(config: GmailConfig) {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      refresh_token: config.refreshToken,
      grant_type: "refresh_token"
    })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Unable to refresh Gmail access token: ${text}`);
  }

  const payload = (await response.json()) as { access_token?: string };
  if (!payload.access_token) {
    throw new Error("Gmail access token was missing from the OAuth response.");
  }

  return payload.access_token;
}

function toBase64Url(input: string) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function buildMimeMessage(input: {
  from: string;
  to: string;
  cc?: string;
  subject: string;
  bodyText: string;
  bodyHtml: string;
}) {
  const boundary = `tsp-${Date.now().toString(16)}`;
  const headers = [
    `From: The Studio Pilates <${input.from}>`,
    `To: ${input.to}`
  ];

  if (input.cc) {
    headers.push(`Cc: ${input.cc}`);
  }

  headers.push(
    `Subject: ${input.subject}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary="${boundary}"`
  );

  return [
    ...headers,
    "",
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    "",
    input.bodyText,
    "",
    `--${boundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    "",
    input.bodyHtml,
    "",
    `--${boundary}--`
  ].join("\r\n");
}

export async function sendGmailMessage(input: {
  to: string;
  cc?: string;
  subject: string;
  bodyText: string;
  bodyHtml: string;
}): Promise<GmailSendResult> {
  const config = getGmailConfig();
  if (!config) {
    throw new Error("Gmail credentials are not configured.");
  }

  const accessToken = await getAccessToken(config);
  const mime = buildMimeMessage({
    from: config.senderEmail,
    to: input.to,
    cc: input.cc,
    subject: `${config.subjectPrefix} ${input.subject}`.trim(),
    bodyText: input.bodyText,
    bodyHtml: input.bodyHtml
  });

  const response = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/${encodeURIComponent(config.userId)}/messages/send`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        raw: toBase64Url(mime)
      })
    }
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Gmail send failed: ${text}`);
  }

  const payload = (await response.json()) as { id?: string; threadId?: string };
  if (!payload.id || !payload.threadId) {
    throw new Error("Gmail send succeeded but message metadata was incomplete.");
  }

  return {
    messageId: payload.id,
    threadId: payload.threadId
  };
}

export type GmailMessageSummary = {
  id: string;
  threadId: string;
  date: string;
  from: string;
  to: string;
  subject: string;
  snippet: string;
  direction: "sent" | "received";
};

type GmailListResponse = {
  messages?: Array<{ id: string; threadId: string }>;
  resultSizeEstimate?: number;
};

type GmailMessageResponse = {
  id: string;
  threadId: string;
  snippet: string;
  payload?: {
    headers?: Array<{ name: string; value: string }>;
  };
};

function getHeader(msg: GmailMessageResponse, name: string): string {
  return msg.payload?.headers?.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? "";
}

export async function searchGmailMessages(input: {
  clientEmail: string;
  direction: "sent" | "received";
  maxResults?: number;
}): Promise<GmailMessageSummary[]> {
  const config = getGmailConfig();
  if (!config) return [];

  const accessToken = await getAccessToken(config);
  const senderEmail = config.senderEmail;
  const query =
    input.direction === "sent"
      ? `from:${senderEmail} to:${input.clientEmail}`
      : `from:${input.clientEmail} to:${senderEmail}`;

  const listUrl = new URL(`https://gmail.googleapis.com/gmail/v1/users/${encodeURIComponent(config.userId)}/messages`);
  listUrl.searchParams.set("q", query);
  listUrl.searchParams.set("maxResults", String(input.maxResults ?? 20));

  const listResponse = await fetch(listUrl.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  if (!listResponse.ok) return [];

  const listData = (await listResponse.json()) as GmailListResponse;
  if (!listData.messages?.length) return [];

  const messages = await Promise.all(
    listData.messages.slice(0, input.maxResults ?? 20).map(async (ref) => {
      const msgUrl = `https://gmail.googleapis.com/gmail/v1/users/${encodeURIComponent(config.userId)}/messages/${ref.id}?format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Subject&metadataHeaders=Date`;
      const msgResponse = await fetch(msgUrl, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });

      if (!msgResponse.ok) return null;

      const msg = (await msgResponse.json()) as GmailMessageResponse;
      return {
        id: msg.id,
        threadId: msg.threadId,
        date: getHeader(msg, "Date"),
        from: getHeader(msg, "From"),
        to: getHeader(msg, "To"),
        subject: getHeader(msg, "Subject"),
        snippet: msg.snippet ?? "",
        direction: input.direction
      } satisfies GmailMessageSummary;
    })
  );

  return messages.filter((m): m is GmailMessageSummary => m !== null);
}

export async function getEmailHistory(clientEmail: string): Promise<GmailMessageSummary[]> {
  if (!getGmailConfig()) return [];

  const [sent, received] = await Promise.all([
    searchGmailMessages({ clientEmail, direction: "sent", maxResults: 30 }),
    searchGmailMessages({ clientEmail, direction: "received", maxResults: 30 })
  ]);

  return [...sent, ...received].sort((a, b) => {
    const dateA = new Date(a.date).getTime();
    const dateB = new Date(b.date).getTime();
    return dateB - dateA;
  });
}
