"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";

import { GlassLens } from "./glass-lens";
import {
  MOTION_DURATION_MS,
  MOTION_EASE,
} from "~/components/motion/motion-tokens";

const ITEM_SELECTOR = '[data-slot$="-item"], [data-slot$="-sub-trigger"]';

const SLIDE = {
  duration: MOTION_DURATION_MS.quick / 1000,
  ease: MOTION_EASE.smoothOut,
} as const;
const INSTANT = { duration: 0 } as const;

type HighlightBox = {
  top: number;
  left: number;
  width: number;
  height: number;
};

/**
 * Container classes for menus that host `MenuGlassHighlight`: items stack
 * between the sliding tint (below) and the lens (above), and hand their own
 * focus fill to the tint. Destructive items keep their red fill.
 */
export const MENU_GLASS_CONTAINER_CLASS =
  "relative isolate [&_[data-slot$=-item]]:z-[1] [&_[data-slot$=-item]:not([data-variant=destructive]):focus]:bg-transparent";

/**
 * Sliding Liquid Glass selection for Radix menus and selects. Radix moves DOM
 * focus to the highlighted option (pointer or keyboard); this follows that
 * focus with an accent tint under the option and a glass + metal-hairline lens
 * over it. Render it as the last child of a `MENU_GLASS_CONTAINER_CLASS`
 * element (the options' offset parent). Decorative only.
 */
export function MenuGlassHighlight() {
  const anchorRef = useRef<HTMLSpanElement>(null);
  // `slide` is true only when moving between options, so the highlight
  // appears in place instead of flying in from the last spot.
  // Hiding keeps the last box so the fade-out happens in place.
  const [{ box, visible, slide }, setHighlight] = useState<{
    box: HighlightBox;
    visible: boolean;
    slide: boolean;
  }>({
    box: { top: 0, left: 0, width: 0, height: 0 },
    visible: false,
    slide: false,
  });
  const reduceMotion = useReducedMotion() === true;

  useEffect(() => {
    const container = anchorRef.current?.parentElement;
    if (!container) return;

    function setBox(next: HighlightBox | null) {
      setHighlight((prev) =>
        next
          ? { box: next, visible: true, slide: prev.visible }
          : { ...prev, visible: false, slide: false },
      );
    }

    function onFocusIn(event: FocusEvent) {
      const target = event.target;
      const item =
        target instanceof HTMLElement
          ? target.closest<HTMLElement>(ITEM_SELECTOR)
          : null;

      if (!item || !container?.contains(item)) {
        setBox(null);
        return;
      }

      setBox({
        top: item.offsetTop,
        left: item.offsetLeft,
        width: item.offsetWidth,
        height: item.offsetHeight,
      });
    }

    function onFocusOut(event: FocusEvent) {
      const next = event.relatedTarget;
      if (!(next instanceof Node) || !container?.contains(next)) setBox(null);
    }

    container.addEventListener("focusin", onFocusIn);
    container.addEventListener("focusout", onFocusOut);
    return () => {
      container.removeEventListener("focusin", onFocusIn);
      container.removeEventListener("focusout", onFocusOut);
    };
  }, []);

  const transition = reduceMotion || !slide ? INSTANT : SLIDE;
  const shared = {
    initial: false,
    animate: { x: box.left, y: box.top, opacity: visible ? 1 : 0 },
    transition: {
      x: transition,
      y: transition,
      opacity: { duration: MOTION_DURATION_MS.quick / 1000 },
    },
    style: { width: box.width, height: box.height },
  } as const;

  return (
    <span ref={anchorRef} aria-hidden="true" className="contents">
      <motion.span
        {...shared}
        className="bg-accent pointer-events-none absolute top-0 left-0 z-0 rounded-xs"
      />
      <motion.span
        {...shared}
        className="pointer-events-none absolute top-0 left-0 z-[2] rounded-xs"
      >
        {visible ? <GlassLens radius="xs" /> : null}
      </motion.span>
    </span>
  );
}
