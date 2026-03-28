import fs from "fs/promises";
import path from "path";

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const EMAIL_BRAND = {
  shell: "#f4ede7",
  card: "#fffaf6",
  border: "#e0d6cc",
  text: "#28200e",
  muted: "#7a6f64",
  brand: "#9f543f",
  wash: "#f5ebe7"
};

function escapeHtml(input) {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderBodyHtml(body) {
  return body
    .replace(/<hr\s*\/?>/gi, "\n\n---\n\n")
    .split(/\n{2,}/)
    .map((paragraph) => {
      const normalized = escapeHtml(paragraph).replace(/\n/g, "<br />");
      return `<p style="margin:0 0 16px;line-height:1.7;">${normalized}</p>`;
    })
    .join("");
}

function renderEmailHtml({ subject, body, name }) {
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(subject)}</title>
  </head>
  <body style="margin:0;background:${EMAIL_BRAND.shell};font-family:Georgia, 'Times New Roman', serif;color:${EMAIL_BRAND.text};">
    <div style="padding:32px 16px;background:linear-gradient(180deg,#f7f1eb 0%,${EMAIL_BRAND.shell} 100%);">
      <div style="max-width:680px;margin:0 auto;">
        <div style="margin-bottom:14px;padding:0 8px;color:${EMAIL_BRAND.brand};font-size:12px;font-family:Arial,sans-serif;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;">
          The Studio Pilates
        </div>
        <div style="background:${EMAIL_BRAND.card};border:1px solid ${EMAIL_BRAND.border};border-radius:24px;overflow:hidden;box-shadow:0 18px 42px rgba(40,32,14,0.08);">
          <div style="padding:28px 32px;background:linear-gradient(135deg,${EMAIL_BRAND.brand},#c98d76);color:#fff7f2;">
            <div style="font-size:12px;font-family:Arial,sans-serif;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;opacity:0.9;">
              ${escapeHtml(name)}
            </div>
            <div style="margin-top:10px;font-size:30px;line-height:1.05;font-weight:700;">
              ${escapeHtml(subject)}
            </div>
          </div>
          <div style="padding:32px;">
            ${renderBodyHtml(body)}
            <div style="margin-top:28px;padding-top:22px;border-top:1px solid ${EMAIL_BRAND.border};font-family:Arial,sans-serif;color:${EMAIL_BRAND.muted};font-size:13px;line-height:1.7;">
              <strong style="display:block;color:${EMAIL_BRAND.text};margin-bottom:4px;">The Studio Pilates Team</strong>
              Source-controlled template export
            </div>
          </div>
          <div style="padding:18px 32px;background:${EMAIL_BRAND.wash};border-top:1px solid ${EMAIL_BRAND.border};font-family:Arial,sans-serif;color:${EMAIL_BRAND.brand};font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;">
            Template source
          </div>
        </div>
      </div>
    </div>
  </body>
</html>`;
}

async function main() {
  const templateDir = path.join(process.cwd(), "template-source");
  const htmlDir = path.join(templateDir, "html");
  const textDir = path.join(templateDir, "text");

  await fs.mkdir(htmlDir, { recursive: true });
  await fs.mkdir(textDir, { recursive: true });

  const rows = await prisma.$queryRawUnsafe(`
    SELECT "key", "name", "subjectTemplate", "bodyTemplate"
    FROM "EmailTemplate"
    ORDER BY "key" ASC
  `);

  const manifest = [];

  for (const row of rows) {
    const record = {
      key: row.key,
      name: row.name,
      subjectTemplate: row.subjectTemplate,
      bodyTemplate: row.bodyTemplate
    };

    manifest.push(record);

    await fs.writeFile(path.join(textDir, `${row.key}.txt`), `${row.subjectTemplate}\n\n${row.bodyTemplate}\n`);
    await fs.writeFile(
      path.join(htmlDir, `${row.key}.html`),
      renderEmailHtml({
        subject: row.subjectTemplate,
        body: row.bodyTemplate,
        name: row.name
      })
    );
  }

  await fs.writeFile(path.join(templateDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`Exported ${manifest.length} templates to ${templateDir}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
