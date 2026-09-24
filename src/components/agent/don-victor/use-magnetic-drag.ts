"use client";

import {
  type RefObject,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { animate, useMotionValue, useReducedMotion } from "motion/react";

import { SPRING_LAYOUT } from "~/lib/ease";

import {
  readDonVictorPosition,
  writeDonVictorPosition,
  type DonVictorPosition,
} from "./don-victor-position";

/** Distance from the top or bottom edge within which the widget snaps to it. */
const VERTICAL_MAGNET_PX = 32;

export type MagneticDragOptions = {
  /** Element whose box is the drag area. */
  boundsRef: RefObject<HTMLElement | null>;
  /**
   * Element at the bottom of the bounds the widget must not cover (the
   * composer). Its height is subtracted from the drag area.
   */
  reserveRef: RefObject<HTMLElement | null>;
  /** Breathing room kept between the widget and the bounds, in px. */
  gap?: number;
  /**
   * Anything that moves the reserved element without resizing it (the
   * composer sliding from the welcome centre to the bottom). A change
   * re-measures.
   */
  layoutKey?: string | number | boolean;
};

type Limits = { maxX: number; maxY: number };

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

/**
 * Free drag inside a container with a magnet on the edges: on release the
 * widget glides to the nearest side, and to the top or bottom when it is
 * close enough. The container and the reserved composer are observed, so a
 * resize re-clamps the widget instead of leaving it stranded outside.
 */
export function useMagneticDrag({
  boundsRef,
  reserveRef,
  gap = 8,
  layoutKey,
}: MagneticDragOptions) {
  const reduceMotion = useReducedMotion() ?? false;
  const widgetRef = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const limitsRef = useRef<Limits>({ maxX: 0, maxY: 0 });
  const positionRef = useRef<DonVictorPosition | null>(null);
  const [ready, setReady] = useState(false);
  const [limits, setLimits] = useState<Limits>({ maxX: 0, maxY: 0 });

  const settle = useCallback(
    (position: DonVictorPosition, instant: boolean) => {
      const { maxX, maxY } = limitsRef.current;
      const targetX = position.side === "left" ? gap : maxX;
      const targetY = clamp(position.top, gap, maxY);

      if (instant) {
        x.set(targetX);
        y.set(targetY);
        return;
      }

      void animate(x, targetX, SPRING_LAYOUT);
      void animate(y, targetY, SPRING_LAYOUT);
    },
    [gap, x, y],
  );

  // Measure the drag area and keep the widget inside it as it changes shape.
  useEffect(() => {
    const bounds = boundsRef.current;
    const widget = widgetRef.current;

    if (!bounds || !widget) {
      return;
    }

    const measure = () => {
      // The reserved element is a child of the bounds, so its offsetTop is
      // the floor of the drag area whether it sits at the bottom or centred.
      const floor = reserveRef.current?.offsetTop ?? bounds.clientHeight;
      const next: Limits = {
        maxX: Math.max(gap, bounds.clientWidth - widget.offsetWidth - gap),
        maxY: Math.max(gap, floor - widget.offsetHeight - gap),
      };

      limitsRef.current = next;
      setLimits(next);

      if (!positionRef.current) {
        positionRef.current = readDonVictorPosition();
        settle(positionRef.current, true);
        setReady(true);
        return;
      }

      settle(positionRef.current, true);
    };

    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(bounds);
    observer.observe(widget);

    const reserve = reserveRef.current;

    if (reserve) {
      observer.observe(reserve);
    }

    return () => observer.disconnect();
  }, [boundsRef, reserveRef, gap, settle, layoutKey]);

  const onDragEnd = useCallback(() => {
    const widget = widgetRef.current;

    if (!widget) {
      return;
    }

    const { maxX, maxY } = limitsRef.current;
    const currentX = x.get();
    const currentY = y.get();
    const centerX = currentX + widget.offsetWidth / 2;
    const side =
      centerX < (maxX + widget.offsetWidth + gap) / 2 ? "left" : "right";

    let top = clamp(currentY, gap, maxY);

    if (top - gap < VERTICAL_MAGNET_PX) {
      top = gap;
    } else if (maxY - top < VERTICAL_MAGNET_PX) {
      top = maxY;
    }

    const position: DonVictorPosition = { side, top };
    positionRef.current = position;
    writeDonVictorPosition(position);
    settle(position, reduceMotion);
  }, [gap, reduceMotion, settle, x, y]);

  return {
    widgetRef,
    x,
    y,
    ready,
    dragConstraints: {
      left: gap,
      top: gap,
      right: limits.maxX,
      bottom: limits.maxY,
    },
    onDragEnd,
  };
}
