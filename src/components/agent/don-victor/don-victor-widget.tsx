"use client";

import { type RefObject, useEffect } from "react";
import {
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
} from "motion/react";

import { useMediaQuery } from "~/hooks/use-media-query";
import { SPRING_PANEL, SPRING_PRESS } from "~/lib/ease";
import { cn } from "~/lib/utils";

import type { DonVictorState } from "./don-victor-choreography";
import { DonVictorSprite } from "./don-victor-sprite";
import { useMagneticDrag } from "./use-magnetic-drag";

/** Tailwind `md`: below it the widget would eat the conversation. */
const WIDGET_MEDIA_QUERY = "(min-width: 768px)";

/** Two sprite pixels per CSS pixel: every pixel stays whole. */
const SPRITE_SIZE_PX = 80;

export type DonVictorWidgetProps = {
  state: DonVictorState;
  /** Chat area the widget is confined to. */
  boundsRef: RefObject<HTMLElement | null>;
  /** Composer at the bottom of the bounds the widget never covers. */
  reserveRef: RefObject<HTMLElement | null>;
  /** Re-measures the drag area when it changes (see `useMagneticDrag`). */
  layoutKey?: string | number | boolean;
  className?: string;
};

/**
 * Don Víctor floating over the conversation: a pixel-art concierge that
 * mirrors the agent's activity, draggable anywhere inside the chat and
 * magnetic to its edges. Desktop only — on phones every pixel belongs to
 * the thread. Purely decorative: the composer already announces the same
 * status, so the widget is hidden from assistive tech.
 */
export function DonVictorWidget({
  state,
  boundsRef,
  reserveRef,
  layoutKey,
  className,
}: DonVictorWidgetProps) {
  const enabled = useMediaQuery(WIDGET_MEDIA_QUERY);

  if (!enabled) {
    return null;
  }

  return (
    <DonVictorFloating
      state={state}
      boundsRef={boundsRef}
      reserveRef={reserveRef}
      layoutKey={layoutKey}
      className={className}
    />
  );
}

function DonVictorFloating({
  state,
  boundsRef,
  reserveRef,
  layoutKey,
  className,
}: DonVictorWidgetProps) {
  const reduce = useReducedMotion() ?? false;
  const { widgetRef, x, y, ready, dragConstraints, onDragEnd } =
    useMagneticDrag({ boundsRef, reserveRef, layoutKey });
  const pose = useMotionValue(1);

  // A new pose gets a small press so the prop reads as picked up, without
  // remounting the canvas (which would drop a frame).
  useEffect(() => {
    if (reduce) {
      return;
    }

    pose.set(0.9);
    const controls = animate(pose, 1, SPRING_PRESS);

    return () => controls.stop();
  }, [state, reduce, pose]);

  return (
    <motion.div
      ref={widgetRef}
      aria-hidden="true"
      drag
      dragConstraints={dragConstraints}
      dragElastic={0.08}
      dragMomentum={false}
      onDragEnd={onDragEnd}
      whileDrag={reduce ? undefined : { scale: 1.06 }}
      initial={false}
      animate={{ opacity: ready ? 1 : 0, scale: ready ? 1 : 0.96 }}
      transition={reduce ? { duration: 0 } : SPRING_PANEL}
      style={{ x, y }}
      className={cn(
        "absolute top-0 left-0 z-30 cursor-grab touch-none rounded-2xl select-none active:cursor-grabbing",
        className,
      )}
    >
      <motion.div style={{ scale: pose }} className="pointer-events-none">
        <DonVictorSprite state={state} size={SPRITE_SIZE_PX} />
      </motion.div>
    </motion.div>
  );
}
