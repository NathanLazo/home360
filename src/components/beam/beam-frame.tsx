"use client";

import type { ComponentProps, CSSProperties, ReactNode } from "react";

import { usePrefersReducedMotion } from "~/hooks/use-prefers-reduced-motion";
import { cn } from "~/lib/utils";

export type BeamVariant =
  /** A sky → lime light travels around the border (main-flow marker). */
  | "orbit"
  /** The whole ring breathes as a halo (closing / reward moments). */
  | "pulse";

export type BeamSize = "sm" | "md" | "lg";

export type BeamFrameProps = Omit<ComponentProps<"div">, "children"> & {
  children: ReactNode;
  variant?: BeamVariant;
  /** Ring width and glow reach: `sm` buttons, `md` cards, `lg` hero frames. */
  size?: BeamSize;
  /** 0–1 opacity of the light layers; the child is never dimmed. */
  strength?: number;
  /** Seconds per orbit (or per breath). */
  duration?: number;
  /**
   * `false` fades the light out without unmounting the child (e.g. hand the
   * marker to a dialog's confirm while it is open).
   */
  active?: boolean;
};

const SIZE_VARS: Record<BeamSize, Record<string, string>> = {
  sm: { "--beam-width": "1.25px", "--beam-glow": "6px" },
  md: { "--beam-width": "1.5px", "--beam-glow": "12px" },
  lg: { "--beam-width": "2px", "--beam-glow": "20px" },
};

const DEFAULT_DURATION: Record<BeamVariant, number> = {
  orbit: 4,
  pulse: 2.8,
};

/**
 * The action tint in motion (DESIGN.md §6): a sky → lime light framing one
 * element. Pure CSS (`globals.css`, `[data-beam-frame]`): a registered
 * `--beam-angle` drives a conic gradient masked to the border box, and a
 * blurred copy behind the child is the glow. No WebGL, SSR-safe, and cheap
 * enough for product surfaces.
 *
 * The wrapper takes the child's radius through `className` (`rounded-pill`,
 * `rounded-xl`…); both light layers inherit it. Give it `flex w-full` when
 * the child is block-level.
 *
 * Motion states: `live` (animated), `still` (reduced motion: the light stays
 * as a static ring, so the marker keeps its meaning) and `off` (`active`
 * false). The first render is `still`, so nothing moves before the browser
 * confirms motion is welcome.
 */
export function BeamFrame({
  children,
  variant = "orbit",
  size = "md",
  strength = 1,
  duration,
  active = true,
  className,
  style,
  ...rest
}: BeamFrameProps) {
  const prefersReducedMotion = usePrefersReducedMotion();
  const state = !active ? "off" : prefersReducedMotion ? "still" : "live";

  const vars: Record<string, string | number> = {
    ...SIZE_VARS[size],
    "--beam-strength": Math.min(1, Math.max(0, strength)),
    "--beam-duration": `${duration ?? DEFAULT_DURATION[variant]}s`,
  };

  return (
    <div
      data-beam-frame=""
      data-variant={variant}
      data-state={state}
      className={cn("relative isolate inline-flex", className)}
      style={{ ...(vars as CSSProperties), ...style }}
      {...rest}
    >
      {children}
      <span aria-hidden="true" data-beam-layer="glow" />
      <span aria-hidden="true" data-beam-layer="ring" />
    </div>
  );
}
