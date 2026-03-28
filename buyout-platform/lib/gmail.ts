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
    mimeType?: string;
    headers?: Array<{ name: string; value: string }>;
    body?: { data?: string };
    parts?: GmailMessagePart[];
  };
};

type GmailMessagePart = {
  mimeType?: string;
  body?: { data?: string };
  parts?: GmailMessagePart[];
};

function decodeBase64Url(data: string) {
  return Buffer.from(data.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf-8");
}

function htmlToText(html: string) {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#\d+;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function findPartData(parts: GmailMessagePart[] | undefined, mimeType: string): string | undefined {
  if (!parts) return undefined;

  for (const part of parts) {
    if (part.mimeType === mimeType && part.body?.data) {
      return part.body.data;
    }
    if (part.parts) {
      const found = findPartData(part.parts, mimeType);
      if (found) return found;
    }
  }

  return undefined;
}

function extractBodyText(msg: GmailMessageResponse): string {
  // Direct body (simple messages)
  if (msg.payload?.body?.data) {
    const decoded = decodeBase64Url(msg.payload.body.data);
    if (msg.payload?.mimeType === "text/html") {
      return htmlToText(decoded);
    }
    return decoded;
  }

  // Search all parts recursively for text/plain first
  const textData = findPartData(msg.payload?.parts, "text/plain");
  if (textData) {
    return decodeBase64Url(textData);
  }

  // Fall back to text/html stripped of tags
  const htmlData = findPartData(msg.payload?.parts, "text/html");
  if (htmlData) {
    return htmlToText(decodeBase64Url(htmlData));
  }

  return msg.snippet ?? "";
}

export type ParsedPayment = {
  gmailMessageId: string;
  threadId: string;
  orderNumber: string;
  clientName: string;
  clientEmail: string;
  amount: number;
  paymentMethod: string;
  productName: string;
  date: string;
  rawSubject: string;
  bodyText: string;
};

const BUYOUT_PRODUCTS = [
  "private buyout",
  "private event",
  "buyout / event",
  "buyout/event",
  "buyout deposit",
  "remaining balance",
  "studio buyout",
  "event deposit",
  "$450"
];

function getHeader(msg: GmailMessageResponse, name: string): string {
  return msg.payload?.headers?.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? "";
}

function extractEmailAddress(input: string) {
  const match = input.match(/<([^>]+)>/) ?? input.match(/([^\s<]+@[^\s>]+)/);
  return match?.[1]?.trim().toLowerCase() ?? "";
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
      ? `in:anywhere from:${senderEmail} to:${input.clientEmail}`
      : `in:anywhere from:${input.clientEmail} to:${senderEmail}`;

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

export async function searchPaymentEmails(maxResults = 20): Promise<ParsedPayment[]> {
  const config = getGmailConfig();
  if (!config) return [];

  const accessToken = await getAccessToken(config);

  // Search all mail, including archived/labeled mail, for WooCommerce order emails.
  // In the real mailbox these messages reliably match the sender + "New order #" subject pattern.
  const query = `in:anywhere from:${config.senderEmail} subject:"New order #"`;

  const listUrl = new URL(`https://gmail.googleapis.com/gmail/v1/users/${encodeURIComponent(config.userId)}/messages`);
  listUrl.searchParams.set("q", query);
  listUrl.searchParams.set("maxResults", String(maxResults));
  listUrl.searchParams.set("includeSpamTrash", "true");

  const listResponse = await fetch(listUrl.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  if (!listResponse.ok) return [];

  const listData = (await listResponse.json()) as GmailListResponse;
  if (!listData.messages?.length) return [];

  const payments: ParsedPayment[] = [];

  for (const ref of listData.messages.slice(0, maxResults)) {
    // Fetch full message content for body parsing
    const msgUrl = `https://gmail.googleapis.com/gmail/v1/users/${encodeURIComponent(config.userId)}/messages/${ref.id}?format=full`;
    const msgResponse = await fetch(msgUrl, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    if (!msgResponse.ok) continue;

    const msg = (await msgResponse.json()) as GmailMessageResponse;
    const subject = getHeader(msg, "Subject");
    const date = getHeader(msg, "Date");
    const replyTo = getHeader(msg, "Reply-To");
    const body = extractBodyText(msg);

    // Extract order number from subject
    const orderMatch = subject.match(/New order #(\d+)/i);
    if (!orderMatch) continue;
    const orderNumber = orderMatch[1];

    // Primary client identity from Reply-To header
    const replyToNameMatch = replyTo.match(/^([^<]+)/);
    const replyToName = replyToNameMatch?.[1]?.trim() ?? "";
    const replyToEmail = extractEmailAddress(replyTo);

    // Fallback name from body
    const bodyNameMatch = body.match(/(?:order from|following order from)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/i);
    const clientName = replyToName || bodyNameMatch?.[1]?.trim() || "";
    const clientEmail = replyToEmail;

    // Extract product name — filter to buyout-related only
    const productMatch = body.match(/(?:Product|Item)[:\s]*\n?\s*([^\n\t]+?)(?:\t|\s{2,}|\n)/i)
      ?? body.match(/(Private Buyout[^\n]*)/i)
      ?? body.match(/(Studio Buyout[^\n]*)/i);
    const productName = productMatch?.[1]?.trim() ?? "";

    const bodyLower = body.toLowerCase();
    const isBuyoutProduct = BUYOUT_PRODUCTS.some((p) =>
      productName.toLowerCase().includes(p) || bodyLower.includes(p)
    );

    // Skip only if we can confirm it's NOT a buyout (e.g., study guide, retail)
    const isDefinitelyNotBuyout = !isBuyoutProduct && (
      bodyLower.includes("study guide") ||
      bodyLower.includes("merchandise") ||
      bodyLower.includes("gift card")
    );
    if (isDefinitelyNotBuyout) continue;

    // Extract total amount — look for Total: line first, then last dollar amount
    const totalMatch = body.match(/Total:\s*\$\s*([0-9,]+\.?\d{0,2})/i);
    const subtotalMatch = body.match(/Subtotal:\s*\$\s*([0-9,]+\.?\d{0,2})/i);
    const anyAmountMatch = body.match(/\$\s*([0-9,]+\.?\d{0,2})/);
    const amountStr = totalMatch?.[1] ?? subtotalMatch?.[1] ?? anyAmountMatch?.[1];
    const amount = amountStr ? parseFloat(amountStr.replace(/,/g, "")) : 0;

    // Extract payment method
    const methodMatch =
      body.match(/Payment method:\s*(.+?)(?:Total:|Billing address|$)/i) ??
      body.match(/Payment method:\s*(.+?)(?:\n|$)/i);
    const paymentMethod = methodMatch?.[1]?.trim() ?? "Unknown";

    if (clientName && amount > 0) {
      payments.push({
        gmailMessageId: ref.id,
        threadId: msg.threadId,
        orderNumber,
        clientName,
        clientEmail,
        amount,
        paymentMethod,
        productName,
        date,
        rawSubject: subject,
        bodyText: body.slice(0, 500)
      });
    }
  }

  return payments;
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
