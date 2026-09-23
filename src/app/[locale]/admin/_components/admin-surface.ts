/**
 * Admin surface vocabulary (DESIGN.md §2, §4, §5): canvas cards on the
 * canvas-soft page, stacked shadows instead of heavy borders, radii 6/8/12
 * and hairline dividers. Kept as literal class strings so Tailwind picks
 * them up, and so every admin module reads as one system.
 */

/**
 * Flush card around a `DataTable`. The shared table already sets the
 * canvas-soft header strip with mono uppercase labels and hairline rows; the
 * card only drops its padding and clips the corners (radius 20).
 */
export const ADMIN_TABLE_CARD_CLASS =
  "gap-0 overflow-hidden py-0 [&_td]:tabular-nums";

/** Header strip of the table skeleton, same tone as the loaded table. */
export const ADMIN_TABLE_HEAD_STRIP_CLASS = "bg-canvas-soft border-b";

/**
 * Selectable/linked card (dispute rows, open-dispute links): canvas with the
 * L2 stack (hairline included, so no `border`), rising to L3 on hover.
 */
export const ADMIN_LINK_CARD_CLASS =
  "bg-card rounded-2xl shadow-subtle transition-[box-shadow,background-color,scale] hover:shadow-soft";

/** Selected state of a linked card: an ink ring replaces the hairline. */
export const ADMIN_LINK_CARD_ACTIVE_CLASS =
  "bg-card rounded-2xl shadow-[0_0_0_1.5px_var(--ink)]";

/** Eyebrow / data caption: section labels inside sheets and panes. */
export const ADMIN_EYEBROW_CLASS =
  "text-muted-foreground font-mono text-label font-medium tracking-wide uppercase";

/** KPI and summary figures: verifiable money/counts in Geist Mono. */
export const ADMIN_FIGURE_CLASS = "font-mono font-semibold tabular-nums";

/**
 * Status tones on the semantic token families (soft = fill, deep = text).
 * For chips that are not `StatusBadge` (urgency, dispute tone, tiers).
 */
export const ADMIN_TONE_CLASS = {
  success: "border-transparent bg-success-soft text-success-deep",
  warning: "border-transparent bg-warning-soft text-warning-deep",
  error: "border-transparent bg-error-soft text-error-deep",
  info: "border-transparent bg-link-soft text-link-deep",
  neutral: "border-transparent bg-canvas-soft-2 text-body",
} as const;

export type AdminTone = keyof typeof ADMIN_TONE_CLASS;
