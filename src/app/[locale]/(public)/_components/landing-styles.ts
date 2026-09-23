/**
 * Shared presentation tokens for the landing sections, so the type scale, the
 * container rhythm, the motion curve and the anchor offset live in one place
 * instead of being retyped per section.
 *
 * The landing speaks the same monochrome zinc language as the dashboard: every
 * color comes from the shadcn tokens (`--background`, `--foreground`,
 * `--muted-foreground`, `--border`, `--primary`…). Dark bands are the same
 * tokens scoped under `.dark`, never a parallel palette.
 */

/**
 * Normative ease-out (transitions.dev "smooth out", DESIGN.md §7): entrances
 * start fast and settle softly, overshoot 0. Same curve as Tailwind's
 * `ease-out` token in `globals.css`.
 */
export const LANDING_EASE: [number, number, number, number] = [
  0.22, 1, 0.36, 1,
];

/** Same curve for CSS arbitrary values. */
export const landingEaseCss = "ease-[cubic-bezier(0.22,1,0.36,1)]";

/** Duration palette in milliseconds. UI ≤ 300 ms, reveals ≤ 700 ms. */
export const LANDING_DURATION = {
  fast: 160,
  standard: 300,
  reveal: 600,
  slow: 700,
} as const;

/** Stagger between siblings: short enough that no section waits on itself. */
export const LANDING_STAGGER_MS = 70;

/** Centered content column shared by every section. */
export const containerClass = "mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8";

/** Vertical rhythm of a regular section. */
export const sectionPaddingClass = "py-24 lg:py-32";

/** Clears the sticky 4rem header with room to spare (minimum 5rem). */
export const anchorOffsetClass = "scroll-mt-24";

/** `h1`, hero only. Sans, tight, 600 ceiling; the accent phrase goes muted. */
export const displayTitleClass =
  "text-[clamp(2.625rem,7vw,5.25rem)] leading-[0.98] font-semibold tracking-[-0.04em] text-balance";

/** `h2`, one per section. */
export const displayHeadingClass =
  "text-[clamp(2rem,4.2vw,3.25rem)] leading-[1.02] font-semibold tracking-[-0.035em] text-balance";

/**
 * Accent phrase inside a display heading: same family, contrast by ink —
 * a lighter weight in the tertiary gray (≥ 3:1 at display sizes, and `.dark`
 * bands flip it through `--mute`). No serif, no gradient text.
 */
export const accentClass = "font-normal text-mute";

/** `h3`, body face. */
export const subheadingClass =
  "text-lg leading-snug font-semibold tracking-[-0.015em]";

/** Data labels: mono only where the text is a verifiable datum. */
export const dataLabelClass =
  "font-mono text-xs font-medium tracking-[0.06em] uppercase";

/** Figures: mono, tabular, never shifting while they animate. */
export const figureClass =
  "font-mono text-[clamp(2.5rem,5vw,3.75rem)] leading-none font-medium tracking-[-0.04em] tabular-nums";

/** Body copy capped near 65 characters. */
export const leadClass =
  "max-w-[62ch] text-base leading-relaxed text-pretty text-muted-foreground sm:text-lg";

/** Card/step body copy. */
export const bodyClass =
  "text-[0.9375rem] leading-relaxed text-pretty text-muted-foreground";

/**
 * Focus ring that reads on light and dark bands alike: it takes the section's
 * own `--ring`/`--background`, so `.dark` bands flip it automatically.
 */
export const focusRingClass =
  "focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none";

/**
 * Press feedback shared by every pressable element. Tailwind 4 scales through
 * the `scale` property, and the hover tint rides the same transition list, so
 * callers never stack two `transition-*` utilities.
 */
export const pressClass =
  "transition-[scale,background-color,color,border-color] duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] active:scale-[0.97] motion-reduce:active:scale-100";

/**
 * Pixel radii for the border beam, which takes a number instead of a class.
 * They mirror the radius scale in `globals.css`: `rounded-xl` = 16 px,
 * `rounded-2xl` = 20 px, `rounded-full`/`rounded-pill` on a 48 px pill = 24 px.
 */
export const LANDING_BEAM_RADIUS = {
  xl: 16,
  twoXl: 20,
  pill: 24,
} as const;
