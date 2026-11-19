import "server-only";

import { getTranslations } from "next-intl/server";

import { escapeHtml } from "./escape-html";
import type {
  EmailAction,
  EmailDetail,
  EmailTemplate,
  RenderedEmail,
} from "./email-template.types";
import { EMAIL_TOKENS as T } from "./email-tokens";

type LayoutCopy = {
  brand: string;
  linkFallback: string;
  footer: string;
};

const paragraph = (text: string): string =>
  `<p style="margin:0 0 16px;font-size:16px;line-height:24px;color:${T.body};">${escapeHtml(text)}</p>`;

const detailRows = (details: readonly EmailDetail[]): string => {
  const rows = details
    .map(
      ({ label, value }, index) => `
        <tr>
          <th scope="row" align="left" class="h360-row" style="padding:12px 16px;${index > 0 ? `border-top:1px solid ${T.hairline};` : ""}font-family:${T.fontMono};font-size:12px;line-height:16px;font-weight:500;letter-spacing:0.04em;text-transform:uppercase;color:${T.mute};white-space:nowrap;vertical-align:top;">${escapeHtml(label)}</th>
          <td align="right" class="h360-row" style="padding:12px 16px;${index > 0 ? `border-top:1px solid ${T.hairline};` : ""}font-size:14px;line-height:20px;font-weight:600;color:${T.ink};">${escapeHtml(value)}</td>
        </tr>`,
    )
    .join("");

  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="h360-card" style="margin:8px 0 24px;border:1px solid ${T.hairline};border-radius:8px;border-collapse:separate;background:${T.canvasSoft};">${rows}
    </table>`;
};

const actionBlock = (action: EmailAction, fallback: string): string => {
  const url = escapeHtml(action.url);

  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 24px;">
      <tr>
        <td align="center" bgcolor="${T.ink}" style="border-radius:100px;">
          <a href="${url}" target="_blank" class="h360-button" style="display:inline-block;padding:12px 24px;border-radius:100px;background:${T.ink};font-size:15px;line-height:20px;font-weight:600;color:${T.onInk};text-decoration:none;">${escapeHtml(action.label)}&nbsp;&rarr;</a>
        </td>
      </tr>
    </table>
    <p style="margin:0 0 24px;font-size:13px;line-height:20px;color:${T.mute};">${escapeHtml(fallback)}<br /><a href="${url}" target="_blank" class="h360-link" style="color:${T.link};word-break:break-all;">${url}</a></p>`;
};

function renderHtml(template: EmailTemplate, copy: LayoutCopy): string {
  const eyebrow = template.eyebrow
    ? `<p style="margin:0 0 8px;font-family:${T.fontMono};font-size:12px;line-height:16px;font-weight:500;letter-spacing:0.04em;text-transform:uppercase;color:${T.mute};">${escapeHtml(template.eyebrow)}</p>`
    : "";
  const notes = (template.notes ?? [])
    .map(
      (note) =>
        `<p style="margin:0 0 8px;font-size:13px;line-height:20px;color:${T.mute};">${escapeHtml(note)}</p>`,
    )
    .join("");

  return `<!doctype html>
<html lang="${template.locale}" dir="ltr" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="x-apple-disable-message-reformatting" />
<meta name="color-scheme" content="light dark" />
<meta name="supported-color-schemes" content="light dark" />
<title>${escapeHtml(template.subject)}</title>
<style>
  body { margin:0; padding:0; -webkit-text-size-adjust:100%; }
  a { text-underline-offset:2px; }
  @media (max-width:600px) { .h360-shell { padding:24px 20px !important; } }
  @media (prefers-color-scheme:dark) {
    .h360-bg { background:#0a0a0a !important; }
    .h360-panel { background:#111111 !important; border-color:#2e2e2e !important; }
    .h360-card { background:#171717 !important; border-color:#2e2e2e !important; }
    .h360-panel h1, .h360-panel td, .h360-wordmark { color:#ededed !important; }
    .h360-panel p, .h360-panel th { color:#a1a1a1 !important; }
    .h360-row { border-color:#2e2e2e !important; }
    .h360-link { color:#52a8ff !important; }
    .h360-button { background:#ededed !important; color:#0a0a0a !important; }
  }
</style>
</head>
<body class="h360-bg" style="margin:0;padding:0;background:${T.canvasSoft};font-family:${T.fontSans};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;" aria-hidden="true">${escapeHtml(template.preheader)}&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;</div>
<div role="article" aria-roledescription="email" aria-label="${escapeHtml(template.subject)}" lang="${template.locale}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="h360-bg" style="background:${T.canvasSoft};">
  <tr>
    <td align="center" style="padding:32px 12px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">
        <tr>
          <td style="padding:0 4px 16px;">
            <span class="h360-wordmark" style="font-size:15px;line-height:20px;font-weight:600;letter-spacing:-0.02em;color:${T.ink};">${escapeHtml(copy.brand)}</span>
          </td>
        </tr>
        <tr>
          <td class="h360-panel" style="background:${T.canvas};border:1px solid ${T.hairline};border-radius:12px;overflow:hidden;">
            <div style="height:3px;line-height:3px;font-size:0;background:${T.tintSky};background-image:linear-gradient(90deg,${T.tintSky},${T.tintLime});">&nbsp;</div>
            <div class="h360-shell" style="padding:32px 40px;">
              ${eyebrow}
              <h1 style="margin:0 0 16px;font-size:24px;line-height:32px;font-weight:600;letter-spacing:-0.96px;color:${T.ink};">${escapeHtml(template.heading)}</h1>
              ${template.paragraphs.map(paragraph).join("")}
              ${template.details?.length ? detailRows(template.details) : ""}
              ${template.action ? actionBlock(template.action, copy.linkFallback) : ""}
              ${notes}
            </div>
          </td>
        </tr>
        <tr>
          <td style="padding:20px 4px 0;">
            <p style="margin:0;font-size:12px;line-height:18px;color:${T.mute};">${escapeHtml(copy.footer)}</p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</div>
</body>
</html>`;
}

function renderText(template: EmailTemplate, copy: LayoutCopy): string {
  const blocks = [
    template.heading,
    ...template.paragraphs,
    ...(template.details?.length
      ? [
          template.details
            .map(({ label, value }) => `${label}: ${value}`)
            .join("\n"),
        ]
      : []),
    ...(template.action
      ? [`${template.action.label}: ${template.action.url}`]
      : []),
    ...(template.notes ?? []),
    `— ${copy.brand}\n${copy.footer}`,
  ];

  return blocks.join("\n\n");
}

/**
 * Renders the shared HOME360 transactional layout: semantic, table-based
 * HTML (inline styles, light/dark aware, preheader, link fallback) plus an
 * equivalent plain-text part for clients and screen readers that prefer it.
 */
export async function renderEmail(
  template: EmailTemplate,
): Promise<RenderedEmail> {
  const t = await getTranslations({
    locale: template.locale,
    namespace: "emails.layout",
  });
  const copy: LayoutCopy = {
    brand: t("brand"),
    linkFallback: t("linkFallback"),
    footer: template.footer ?? t("footer"),
  };

  return {
    subject: template.subject,
    html: renderHtml(template, copy),
    text: renderText(template, copy),
  };
}
