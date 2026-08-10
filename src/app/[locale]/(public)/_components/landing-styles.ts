/**
 * Shared presentation tokens for the landing sections, so the type scale, the
 * container rhythm and the anchor offset of `spec/DESIGN-DIRECTIVE.md` §2 and
 * §5 live in one place instead of being retyped per section.
 *
 * Only `(public)/` imports this module: the brand tokens stay on this side of
 * the D7 boundary.
 */

/** Signature easing of the landing (§4). Overshoot 0. */
export const LANDING_EASE: [number, number, number, number] = [0.4, 0, 0.2, 1];

/** Duration palette in milliseconds (§4). */
export const LANDING_DURATION = {
  fast: 150,
  standard: 300,
  slow: 500,
} as const;

/** Stagger between siblings; total budget stays under 500 ms per section. */
export const LANDING_STAGGER_MS = 80;

/** Centered content column shared by every section (§5). */
export const containerClass = "mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8";

/** Vertical rhythm of a regular section (§5). */
export const sectionPaddingClass = "py-20 lg:py-28";

/** Clears the sticky 4rem header with room to spare (§5: minimum 5rem). */
export const anchorOffsetClass = "scroll-mt-24";

/** `h1`, display face, hero only. */
export const displayTitleClass =
  "font-display text-[clamp(2.5rem,6vw,4.5rem)] leading-[1.05] font-bold tracking-[-0.02em] text-balance";

/** `h2`, display face, one per section. */
export const displayHeadingClass =
  "font-display text-[clamp(1.875rem,3.5vw,2.75rem)] leading-[1.1] font-semibold tracking-[-0.015em] text-balance";

/** `h3`, body face: cards and steps never take the display face. */
export const subheadingClass =
  "text-lg leading-snug font-semibold tracking-[-0.01em]";

/** Eyebrows, step numbers and data labels: mono carries "this is a fact". */
export const eyebrowClass =
  "font-mono text-xs font-medium tracking-[0.08em] uppercase";

/** Figures: mono, tabular, never shifting while they animate. */
export const figureClass =
  "font-mono text-[clamp(2rem,4vw,3rem)] leading-none font-semibold tracking-[-0.02em] tabular-nums";

/** Body copy capped near 70 characters. */
export const leadClass = "text-base leading-relaxed text-pretty sm:text-[1.0625rem]";

/** Focus ring over cream surfaces (add the radius at the call site). */
export const focusRingOnCream =
  "focus-visible:ring-2 focus-visible:ring-[var(--brand-navy)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--brand-cream)] focus-visible:outline-none";

/** Focus ring over navy surfaces (add the radius at the call site). */
export const focusRingOnNavy =
  "focus-visible:ring-2 focus-visible:ring-[var(--brand-cream)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--brand-navy)] focus-visible:outline-none";
