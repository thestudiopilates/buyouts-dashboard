const EMAIL_BRAND = {
  shell: "#f4ede7",
  card: "#fffaf6",
  border: "#e0d6cc",
  text: "#28200e",
  muted: "#7a6f64",
  brand: "#9f543f",
  accent: "#006976",
  wash: "#f5ebe7"
} as const;

function escapeHtml(input: string) {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function renderEmailBodyHtml(body: string) {
  const paragraphOpen = '<p style="margin:0 0 16px;line-height:1.7;">';
  const paragraphClose = "</p>";

  return `${paragraphOpen}${escapeHtml(body)
    .replace(/&lt;hr\s*\/?&gt;/gi, `${paragraphClose}<hr style="margin:24px 0;border:none;border-top:1px solid ${EMAIL_BRAND.border};" />${paragraphOpen}`)
    .replace(/&lt;b&gt;/gi, "<strong>")
    .replace(/&lt;\/b&gt;/gi, "</strong>")
    .replace(/\n{2,}/g, `${paragraphClose}${paragraphOpen}`)
    .replace(/\n/g, "<br />")}${paragraphClose}`
    .replace(new RegExp(`${paragraphOpen}\\s*${paragraphClose}`, "g"), "");
}

export function renderEmailHtml(input: {
  subject: string;
  body: string;
  previewLabel?: string;
}) {
  const previewLabel = input.previewLabel ?? "Studio Buyout";
  const bodyHtml = renderEmailBodyHtml(input.body);

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(input.subject)}</title>
  </head>
  <body style="margin:0;background:${EMAIL_BRAND.shell};font-family:Georgia, 'Times New Roman', serif;color:${EMAIL_BRAND.text};">
    <div style="padding:32px 16px;background:linear-gradient(180deg, #f7f1eb 0%, ${EMAIL_BRAND.shell} 100%);">
      <div style="max-width:680px;margin:0 auto;">
        <div style="margin-bottom:14px;padding:0 8px;color:${EMAIL_BRAND.brand};font-size:12px;font-family:'Arial',sans-serif;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;">
          The Studio Pilates
        </div>
        <div style="background:${EMAIL_BRAND.card};border:1px solid ${EMAIL_BRAND.border};border-radius:24px;overflow:hidden;box-shadow:0 18px 42px rgba(40,32,14,0.08);">
          <div style="padding:28px 32px;background:linear-gradient(135deg, ${EMAIL_BRAND.brand}, #c98d76);color:#fff7f2;">
            <div style="font-size:12px;font-family:'Arial',sans-serif;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;opacity:0.9;">
              ${escapeHtml(previewLabel)}
            </div>
            <div style="margin-top:10px;font-size:30px;line-height:1.05;font-weight:700;">
              ${escapeHtml(input.subject)}
            </div>
          </div>
          <div style="padding:32px;">
            ${bodyHtml}
            <div style="margin-top:28px;padding-top:22px;border-top:1px solid ${EMAIL_BRAND.border};font-family:'Arial',sans-serif;color:${EMAIL_BRAND.muted};font-size:13px;line-height:1.7;">
              <strong style="display:block;color:${EMAIL_BRAND.text};margin-bottom:4px;">The Studio Pilates Team</strong>
              Buyout operations and event coordination
            </div>
          </div>
          <div style="padding:18px 32px;background:${EMAIL_BRAND.wash};border-top:1px solid ${EMAIL_BRAND.border};font-family:'Arial',sans-serif;color:${EMAIL_BRAND.accent};font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;">
            Internal preview
          </div>
        </div>
      </div>
    </div>
  </body>
</html>`;
}
