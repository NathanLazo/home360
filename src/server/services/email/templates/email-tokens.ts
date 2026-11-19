/**
 * DESIGN.md tokens inlined for email clients (no CSS variables, no external
 * fonts). Contrast on canvas (WCAG AA): ink 17.9:1, body 8.4:1, mute 5.3:1,
 * link 5.6:1; on-ink over ink 17.9:1.
 */
export const EMAIL_TOKENS = {
  ink: "#171717",
  onInk: "#ffffff",
  body: "#4d4d4d",
  mute: "#6b6b6b",
  hairline: "#ebebeb",
  canvas: "#ffffff",
  canvasSoft: "#fafafa",
  link: "#0761d1",
  tintSky: "#4f9fd8",
  tintLime: "#a8d96c",
  fontSans:
    "Geist, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
  fontMono:
    "'Geist Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
} as const;
