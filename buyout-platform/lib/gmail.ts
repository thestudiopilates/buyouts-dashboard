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
  subject: string;
  bodyText: string;
  bodyHtml: string;
}) {
  const boundary = `tsp-${Date.now().toString(16)}`;

  return [
    `From: The Studio Pilates <${input.from}>`,
    `To: ${input.to}`,
    `Subject: ${input.subject}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
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
