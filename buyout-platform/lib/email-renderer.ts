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
  seaglassBorder: "#1a8a97",
  seaglassLabel: "#b8e6ec",
  sage: "#797F5D",
  sunshine: "#F2A408",
  apricot: "#E0800E",
  wash: "#F5EBE7"
} as const;

const FONT_HEADING = "Georgia, 'Playfair Display', 'Times New Roman', serif";
const FONT_BODY = "'DM Sans', 'Adelle Sans', Helvetica, Arial, sans-serif";

const SECTION_BAR_COLORS = [
  EMAIL_BRAND.terracotta,
  EMAIL_BRAND.seaglass,
  EMAIL_BRAND.sunshine,
  EMAIL_BRAND.terracotta,
  EMAIL_BRAND.seaglass,
  EMAIL_BRAND.sunshine
];

const EVENT_SECTION_TITLES = new Set([
  "your event",
  "your confirmed event",
  "your buyout details",
  "event details",
  "cancelled event",
  "buyout on hold",
  "current event details"
]);

const PAYMENT_SECTION_TITLES = new Set([
  "payment summary",
  "payment details",
  "payment status",
  "refund details"
]);

function escapeHtml(input: string) {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeInline(text: string) {
  return escapeHtml(text)
    .replace(/&lt;b&gt;/gi, `<strong style="color:${EMAIL_BRAND.coffee};">`)
    .replace(/&lt;\/b&gt;/gi, "</strong>");
}

function pStyle() {
  return `margin:0 0 16px;line-height:1.7;font-family:${FONT_BODY};font-size:15px;color:${EMAIL_BRAND.text};`;
}

function renderKeyValueCard(
  title: string,
  rows: Array<[string, string]>,
  bg: string,
  borderColor: string,
  labelColor: string,
  valueColor: string,
  titleColor: string
) {
  const rowsHtml = rows
    .map(
      ([label, value], index) =>
        `<tr>` +
        `<td style="padding:8px 0${index > 0 ? `;border-top:1px solid ${borderColor}` : ""};font-family:${FONT_BODY};font-size:13px;color:${labelColor};width:100px;vertical-align:top;">${escapeHtml(label)}</td>` +
        `<td style="padding:8px 0${index > 0 ? `;border-top:1px solid ${borderColor}` : ""};font-family:${FONT_BODY};font-size:15px;color:${valueColor};font-weight:600;">${escapeInline(value)}</td>` +
        `</tr>`
    )
    .join("");

  return (
    `<div style="margin:0 0 24px;background:${bg};border-radius:10px;overflow:hidden;">` +
    `<div style="padding:16px 20px 8px;">` +
    `<div style="font-family:${FONT_BODY};font-size:10px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;color:${titleColor};margin-bottom:12px;">${escapeHtml(title)}</div>` +
    `<table style="width:100%;border-collapse:collapse;">${rowsHtml}</table>` +
    `</div></div>`
  );
}

function renderSectionHeader(title: string, barColor: string) {
  return (
    `<div style="display:flex;align-items:center;gap:8px;margin:24px 0 12px;">` +
    `<div style="width:4px;height:20px;background:${barColor};border-radius:2px;"></div>` +
    `<span style="font-family:${FONT_HEADING};font-size:17px;font-weight:700;color:${EMAIL_BRAND.text};">${escapeHtml(title)}</span>` +
    `</div>`
  );
}

function renderBulletBox(items: string[]) {
  const itemsHtml = items
    .map((item) => {
      const cleaned = item.replace(/^[•✓]\s*/, "");
      return `<p style="margin:0 0 8px;font-family:${FONT_BODY};font-size:14px;line-height:1.6;color:${EMAIL_BRAND.text};">&#10003; ${escapeInline(cleaned)}</p>`;
    })
    .join("");

  return `<div style="background:${EMAIL_BRAND.oatLight};border-radius:8px;padding:16px 20px;margin-bottom:24px;">${itemsHtml}</div>`;
}

function renderClosingCard(headline: string, body: string) {
  return (
    `<div style="background:linear-gradient(135deg,${EMAIL_BRAND.wash},${EMAIL_BRAND.oat});border-radius:8px;padding:20px 24px;text-align:center;margin:24px 0;">` +
    `<p style="margin:0 0 4px;font-family:${FONT_HEADING};font-size:16px;color:${EMAIL_BRAND.text};font-weight:600;">${escapeHtml(headline)}</p>` +
    `<p style="margin:0;font-family:${FONT_BODY};font-size:13px;color:${EMAIL_BRAND.muted};line-height:1.5;">${escapeInline(body)}</p>` +
    `</div>`
  );
}

function isClosingLine(line: string) {
  const lower = line.toLowerCase().trim();
  return (
    lower.startsWith("warmly,") ||
    lower.startsWith("best,") ||
    lower.startsWith("thanks,") ||
    lower.startsWith("thank you,")
  );
}

function collectKeyValueLines(lines: string[], startIndex: number) {
  const kvLines: Array<[string, string]> = [];
  let i = startIndex;

  while (i < lines.length) {
    const line = lines[i].trim();
    if (!line) {
      i++;
      continue;
    }

    const kvMatch = line.match(/^<b>([^<]+):<\/b>\s*(.+)$/i);
    if (kvMatch) {
      kvLines.push([kvMatch[1], kvMatch[2]]);
      i++;
    } else {
      break;
    }
  }

  return { kvLines, endIndex: i };
}

function skipEmpty(lines: string[], index: number) {
  while (index < lines.length && !lines[index].trim()) {
    index++;
  }

  return index;
}

export function renderEmailBodyHtml(body: string) {
  const lines = body.split("\n");
  const html: string[] = [];
  let i = 0;
  let sectionColorIndex = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      i++;
      continue;
    }

    const inlineHrMatch = trimmed.match(/^<hr\s*\/?>\s*<b>([^<]+)<\/b>$/i);
    if (inlineHrMatch) {
      const title = inlineHrMatch[1].trim();
      const titleLower = title.toLowerCase();
      const afterHeader = skipEmpty(lines, i + 1);
      const { kvLines, endIndex } = collectKeyValueLines(lines, afterHeader);

      if (kvLines.length >= 2 && EVENT_SECTION_TITLES.has(titleLower)) {
        html.push(
          renderKeyValueCard(
            title, kvLines,
            EMAIL_BRAND.seaglass, EMAIL_BRAND.seaglassBorder,
            EMAIL_BRAND.seaglassLabel, EMAIL_BRAND.oat, EMAIL_BRAND.seaglassLabel
          )
        );
        i = endIndex;
        continue;
      }

      if (kvLines.length >= 2 && PAYMENT_SECTION_TITLES.has(titleLower)) {
        html.push(
          renderKeyValueCard(
            title, kvLines,
            EMAIL_BRAND.coffee, "#3d321f",
            EMAIL_BRAND.terracotta, EMAIL_BRAND.oat, EMAIL_BRAND.terracotta
          )
        );
        i = endIndex;
        continue;
      }

      const barColor = SECTION_BAR_COLORS[sectionColorIndex % SECTION_BAR_COLORS.length];
      sectionColorIndex++;
      html.push(renderSectionHeader(title, barColor));
      i++;
      continue;
    }

    if (/^<hr\s*\/?>$/i.test(trimmed)) {
      const next = skipEmpty(lines, i + 1);

      if (next < lines.length) {
        const nextLine = lines[next].trim();
        const headerMatch = nextLine.match(/^<b>([^<]+)<\/b>$/i);

        if (headerMatch) {
          const title = headerMatch[1].trim();
          const titleLower = title.toLowerCase();
          const afterHeader = skipEmpty(lines, next + 1);
          const { kvLines, endIndex } = collectKeyValueLines(lines, afterHeader);

          if (kvLines.length >= 2 && EVENT_SECTION_TITLES.has(titleLower)) {
            html.push(
              renderKeyValueCard(
                title,
                kvLines,
                EMAIL_BRAND.seaglass,
                EMAIL_BRAND.seaglassBorder,
                EMAIL_BRAND.seaglassLabel,
                EMAIL_BRAND.oat,
                EMAIL_BRAND.seaglassLabel
              )
            );
            i = endIndex;
            continue;
          }

          if (kvLines.length >= 2 && PAYMENT_SECTION_TITLES.has(titleLower)) {
            html.push(
              renderKeyValueCard(
                title,
                kvLines,
                EMAIL_BRAND.coffee,
                "#3d321f",
                EMAIL_BRAND.terracotta,
                EMAIL_BRAND.oat,
                EMAIL_BRAND.terracotta
              )
            );
            i = endIndex;
            continue;
          }

          const barColor = SECTION_BAR_COLORS[sectionColorIndex % SECTION_BAR_COLORS.length];
          sectionColorIndex++;
          html.push(renderSectionHeader(title, barColor));
          i = next + 1;
          continue;
        }
      }

      html.push(`<hr style="margin:24px 0;border:none;border-top:1px solid ${EMAIL_BRAND.border};" />`);
      i++;
      continue;
    }

    if (/^[•✓]/.test(trimmed)) {
      const bullets: string[] = [];

      while (i < lines.length) {
        const bl = lines[i].trim();

        if (/^[•✓]/.test(bl)) {
          bullets.push(bl);
          i++;
        } else if (!bl) {
          i++;
        } else {
          break;
        }
      }

      html.push(renderBulletBox(bullets));
      continue;
    }

    if (isClosingLine(trimmed)) {
      const signoff: string[] = [];

      while (i < lines.length) {
        const sl = lines[i].trim();

        if (!sl && signoff.length > 0) {
          break;
        }

        if (sl || signoff.length === 0) {
          signoff.push(sl);
        }

        i++;
      }

      html.push(
        `<p style="${pStyle()}">${signoff.map((l) => escapeInline(l)).join("<br />")}</p>`
      );
      continue;
    }

    const inlineKvMatch = trimmed.match(/^<b>([^<]+):<\/b>\s*(.+)$/i);
    if (inlineKvMatch) {
      html.push(
        `<p style="${pStyle()}"><strong style="color:${EMAIL_BRAND.coffee};">${escapeHtml(inlineKvMatch[1])}:</strong> ${escapeInline(inlineKvMatch[2])}</p>`
      );
      i++;
      continue;
    }

    html.push(`<p style="${pStyle()}">${escapeInline(trimmed)}</p>`);
    i++;
  }

  return html.join("");
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
          <div style="padding:36px 32px 28px;background:${EMAIL_BRAND.coffee};text-align:center;">
            <div style="font-family:${FONT_BODY};font-size:10px;font-weight:700;letter-spacing:0.2em;text-transform:uppercase;color:${EMAIL_BRAND.terracotta};">
              ${escapeHtml(previewLabel)}
            </div>
            <div style="margin-top:14px;font-family:${FONT_HEADING};font-size:26px;line-height:1.2;font-weight:700;color:${EMAIL_BRAND.oat};">
              ${escapeHtml(input.subject)}
            </div>
          </div>
          <div style="height:3px;background:linear-gradient(90deg,${EMAIL_BRAND.terracotta},${EMAIL_BRAND.apricot},${EMAIL_BRAND.terracotta});"></div>
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
