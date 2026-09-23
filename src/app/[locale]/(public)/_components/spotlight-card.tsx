"use client";

import { useRef } from "react";
import {
  motion,
  useMotionTemplate,
  useMotionValue,
  useSpring,
} from "motion/react";

import { useLandingReducedMotion } from "./use-landing-reduced-motion";
import { cn } from "~/lib/utils";

type SpotlightCardProps = {
  children: React.ReactNode;
  className?: string;
  /** Diameter of the light in px. */
  size?: number;
  /**
   * Hover lift on the card itself. Off when a frame around the card (the
   * border beam) must lift with it, so the frame carries the lift instead.
   */
  lift?: boolean;
};

const SPOTLIGHT_SPRING = { stiffness: 380, damping: 40, mass: 0.6 };

/**
 * Cursor-follow light for a static card. The light is a fixed radial disc
 * moved with `transform` (never a repainted gradient), sprung so it trails the
 * pointer instead of snapping to it. Mouse only: touch and pen never trigger a
 * phantom hover, and reduced motion keeps the plain card.
 *
 * The card itself is not interactive; the hover lift is CSS, gated to real
 * hover devices.
 */
export function SpotlightCard({
  children,
  className,
  size = 360,
  lift = true,
}: SpotlightCardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = useLandingReducedMotion();
  const pointerX = useMotionValue(0);
  const pointerY = useMotionValue(0);
  const x = useSpring(pointerX, SPOTLIGHT_SPRING);
  const y = useSpring(pointerY, SPOTLIGHT_SPRING);
  const transform = useMotionTemplate`translate3d(${x}px, ${y}px, 0)`;

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (event.pointerType !== "mouse" || ref.current === null) return;
    const rect = ref.current.getBoundingClientRect();
    pointerX.set(event.clientX - rect.left - size / 2);
    pointerY.set(event.clientY - rect.top - size / 2);
  }

  function handlePointerEnter(event: React.PointerEvent<HTMLDivElement>) {
    if (event.pointerType !== "mouse" || ref.current === null) return;
    const rect = ref.current.getBoundingClientRect();
    // Jump, don't glide, to the entry point: the light starts under the cursor.
    pointerX.jump(event.clientX - rect.left - size / 2);
    pointerY.jump(event.clientY - rect.top - size / 2);
    x.jump(pointerX.get());
    y.jump(pointerY.get());
  }

  return (
    <div
      ref={ref}
      onPointerMove={handlePointerMove}
      onPointerEnter={handlePointerEnter}
      className={cn(
        "group/spotlight bg-card text-card-foreground shadow-soft relative isolate rounded-lg",
        // Lift on `translate`, elevation from L3 to L4 on hover: nothing here
        // touches layout. Tailwind 4 already gates `hover:` to devices that
        // can hover.
        lift &&
          "hover:shadow-float transition-[translate,box-shadow] duration-200 ease-out hover:-translate-y-0.5",
        "motion-reduce:transition-none motion-reduce:hover:translate-y-0",
        className,
      )}
    >
      {prefersReducedMotion ? null : (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-10 overflow-hidden rounded-[inherit]"
        >
          <motion.div
            style={{ transform, width: size, height: size }}
            className="absolute top-0 left-0 rounded-full bg-[radial-gradient(closest-side,color-mix(in_oklch,var(--foreground)_9%,transparent),transparent)] opacity-0 transition-opacity duration-300 group-hover/spotlight:opacity-100"
          />
        </div>
      )}
      {children}
    </div>
  );
}
