const EMAIL_BRAND = {
  coffee: "#28200E",
  oat: "#EEE2D9",
  oatLight: "#F7F3EF",
  card: "#FEFCFA",
  border: "#E0D6CC",
  text: "#28200E",
  muted: "#7A6F64",
  terracotta: "#9F543F",
  seaglass: "#006976",
  sage: "#797F5D",
  wash: "#F5EBE7"
} as const;

const FONT_HEADING = "Georgia, 'Playfair Display', 'Times New Roman', serif";
const FONT_BODY = "'DM Sans', 'Adelle Sans', Helvetica, Arial, sans-serif";

function escapeHtml(input: string) {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function renderEmailBodyHtml(body: string) {
  const paragraphOpen = `<p style="margin:0 0 16px;line-height:1.7;font-family:${FONT_BODY};font-size:15px;color:${EMAIL_BRAND.text};">`;
  const paragraphClose = "</p>";

  return `${paragraphOpen}${escapeHtml(body)
    .replace(/&lt;hr\s*\/?&gt;/gi, `${paragraphClose}<hr style="margin:24px 0;border:none;border-top:1px solid ${EMAIL_BRAND.border};" />${paragraphOpen}`)
    .replace(/&lt;b&gt;/gi, `<strong style="color:${EMAIL_BRAND.coffee};">`)
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
  <body style="margin:0;padding:0;background:${EMAIL_BRAND.oat};font-family:${FONT_BODY};color:${EMAIL_BRAND.text};">
    <div style="padding:32px 16px;background:${EMAIL_BRAND.oat};">
      <div style="max-width:600px;margin:0 auto;">
        <div style="margin-bottom:16px;padding:0 4px;text-align:center;">
          <span style="font-family:${FONT_HEADING};font-size:18px;font-weight:600;color:${EMAIL_BRAND.terracotta};letter-spacing:0.5px;">The Studio Pilates</span>
        </div>
        <div style="background:${EMAIL_BRAND.card};border:1px solid ${EMAIL_BRAND.border};border-radius:12px;overflow:hidden;">
          <div style="padding:28px 32px 24px;background:${EMAIL_BRAND.coffee};text-align:center;">
            <div style="font-family:${FONT_BODY};font-size:11px;font-weight:700;letter-spacing:0.15em;text-transform:uppercase;color:${EMAIL_BRAND.terracotta};opacity:0.85;">
              ${escapeHtml(previewLabel)}
            </div>
            <div style="margin-top:12px;font-family:${FONT_HEADING};font-size:24px;line-height:1.2;font-weight:700;color:${EMAIL_BRAND.oat};">
              ${escapeHtml(input.subject)}
            </div>
          </div>
          <div style="height:3px;background:${EMAIL_BRAND.terracotta};"></div>
          <div style="padding:32px 32px 24px;">
            ${bodyHtml}
          </div>
          <div style="padding:0 32px;">
            <div style="border-top:1px solid ${EMAIL_BRAND.border};"></div>
          </div>
          <div style="padding:20px 32px 24px;text-align:center;">
            <div style="font-family:${FONT_HEADING};font-size:14px;font-weight:600;color:${EMAIL_BRAND.terracotta};">The Studio Pilates</div>
            <div style="margin-top:4px;font-family:${FONT_BODY};font-size:12px;color:${EMAIL_BRAND.sage};line-height:1.5;">
              thestudiopilates.com &middot; events@thestudiopilates.com
            </div>
          </div>
        </div>
      </div>
    </div>
  </body>
</html>`;
}
