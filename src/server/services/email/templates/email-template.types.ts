export type EmailLocale = "es" | "en";

export type EmailDetail = {
  label: string;
  value: string;
};

export type EmailAction = {
  label: string;
  url: string;
};

/**
 * Content of a transactional email. Every string arrives already translated
 * and interpolated: the layout never sees an ICU placeholder.
 */
export type EmailTemplate = {
  locale: EmailLocale;
  subject: string;
  /** Inbox preview line (hidden in the body). */
  preheader: string;
  /** Mono eyebrow above the heading, e.g. "Nueva solicitud". */
  eyebrow?: string;
  heading: string;
  paragraphs: readonly string[];
  details?: readonly EmailDetail[];
  action?: EmailAction;
  /** Small print under the action (expiry, safety notes). */
  notes?: readonly string[];
  /** Why the recipient got this email; defaults to the layout footer. */
  footer?: string;
};

export type RenderedEmail = {
  subject: string;
  html: string;
  text: string;
};
