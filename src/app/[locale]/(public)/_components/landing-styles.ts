import { MOTION_EASE } from "~/components/motion/motion-tokens";

/**
 * Shared presentation tokens for the landing sections, so the type scale, the
 * container rhythm, the motion curve and the anchor offset live in one place
 * instead of being retyped per section.
 *
 * The landing speaks the platform's single ink system (DESIGN.md): page on
 * `canvas-soft`, cards on `canvas` lifted by stacked shadows, Geist display
 * scale, Geist Mono for verifiable data. It only turns the intensity up.
 */

/**
 * Normative ease-out (transitions.dev "smooth out", DESIGN.md §7) for
 * motion/react. CSS lanes use Tailwind's `ease-out`, which is the same curve.
 */
export const LANDING_EASE = MOTION_EASE.smoothOut;

/** Duration palette in milliseconds. UI ≤ 300 ms, reveals ≤ 600 ms. */
export const LANDING_DURATION = {
  fast: 150,
  standard: 250,
  reveal: 600,
} as const;

/** Stagger between siblings: short enough that no section waits on itself. */
export const LANDING_STAGGER_MS = 60;

/** Centered content column shared by every section. */
export const containerClass = "mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8";

/** Vertical rhythm of a regular section. */
export const sectionPaddingClass = "py-20 lg:py-28";

/** Clears the floating 64 px glass nav (+12 px inset) with room to spare. */
export const anchorOffsetClass = "scroll-mt-24";

/**
 * Captures the light-scope ink on the landing root so `.dark` descendants
 * (whose `--ink` flips to near-white) can still paint the ink surface.
 */
export const inkCaptureClass = "[--landing-ink:var(--ink)]";

/**
 * Ink band / ink surface: polarity-flipped block. `.dark` scopes the tokens
 * for its content (ink text becomes near-white, hairlines white 10 %) while
 * the fill stays the light-scope ink #171717.
 */
export const inkSurfaceClass = "dark bg-[var(--landing-ink)] text-foreground";

/** `h1`, hero only. Display hero scale: weight 600, -0.05em tracking. */
export const heroTitleClass = "text-display-hero text-balance";

/** `h2`, one per section (and the closing CTA). */
export const displayHeadingClass =
  "text-display-lg text-balance md:text-display-xl";

/**
 * Accent phrase inside a display heading (owner's pick): Fraunces at its
 * softest, light and upright, in the tertiary gray (≥ 3:1 at display sizes;
 * `.dark` bands flip it through `--mute`). Landing only.
 */
export const accentClass =
  "font-display text-mute font-light tracking-[-0.03em] [font-variation-settings:'SOFT'_100,'opsz'_144]";

/** `h3`, cards and steps. */
export const subheadingClass = "text-display-sm";

/** Technical labels and eyebrows: Geist Mono, verifiable data only. */
export const dataLabelClass =
  "font-mono text-label font-medium tracking-wide uppercase";

/** Figures: mono, tabular, never shifting while they animate. */
export const figureClass =
  "font-mono text-[2.5rem] leading-none font-medium tracking-[-0.04em] tabular-nums sm:text-5xl";

/** Section lead, capped near 65 characters. */
export const leadClass =
  "max-w-[62ch] text-copy text-pretty text-muted-foreground sm:text-lg sm:leading-7";

/** Card/step body copy. */
export const bodyClass = "text-copy text-pretty text-muted-foreground";

/**
 * Focus ring (DESIGN.md §9): blue `ring` with offset; the offset takes the
 * scope's own `--background`, so `.dark` bands flip it automatically.
 */
export const focusRingClass =
  "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none";

/**
 * Press feedback for pressables that are not `Button` (nav links, text
 * links). The hover tint rides the same transition list.
 */
export const pressClass =
  "transition-[scale,background-color,color] duration-150 ease-out active:scale-[0.97] motion-reduce:active:scale-100";
