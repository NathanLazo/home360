"use client";

import { BorderBeam, type BorderBeamProps } from "border-beam";

import { useLandingReducedMotion } from "./use-landing-reduced-motion";
import { cn } from "~/lib/utils";

type LandingBeamProps = Omit<BorderBeamProps, "active"> & {
  /**
   * Let the child paint outside the beam frame (drop shadows, hover lifts).
   * The beam's own layers are clipped with `clip-path`, so lifting the
   * wrapper's `overflow: hidden` never lets the light spill.
   */
  allowOverflow?: boolean;
};

/**
 * The landing's only source of color: a spectral beam traced around a frame.
 * Everything else on the page is zinc and chrome, so the beam is kept rare —
 * the hero console, the recommended plan and the closing CTA.
 *
 * The first render is inactive (the reduced-motion hook starts at `true`), so
 * the beam fades in only once the browser confirms motion is welcome, and it
 * never starts under `prefers-reduced-motion`.
 */
export function LandingBeam({
  allowOverflow = false,
  className,
  children,
  ...props
}: LandingBeamProps) {
  const prefersReducedMotion = useLandingReducedMotion();

  return (
    <BorderBeam
      {...props}
      active={!prefersReducedMotion}
      className={cn(allowOverflow && "overflow-visible!", className)}
    >
      {children}
    </BorderBeam>
  );
}
