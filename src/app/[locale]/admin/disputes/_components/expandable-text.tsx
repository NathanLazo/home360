"use client";

import { ChevronDownIcon } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { useLayoutEffect, useRef, useState } from "react";

import {
  ADMIN_DURATION,
  ADMIN_EASE_OUT,
  PRESS_CONTROL_CLASS,
} from "../../_components/admin-motion";
import { cn } from "~/lib/utils";

/** Collapsed height: four lines of `text-sm` (4 × 1.25rem). */
const COLLAPSED_HEIGHT_PX = 80;

/**
 * Long argument text collapses to four lines behind a fade so the resolution
 * buttons stay within reach; the toggle only renders when the text actually
 * overflows. Height is the one non-transform property animated here — the
 * accepted exception for disclosure — and it snaps under reduced motion.
 */
export function ExpandableText({
  text,
  expandLabel,
  collapseLabel,
  className,
}: {
  text: string;
  expandLabel: string;
  collapseLabel: string;
  className?: string;
}) {
  const reduceMotion = useReducedMotion();
  const contentRef = useRef<HTMLParagraphElement>(null);
  const [fullHeight, setFullHeight] = useState<number | null>(null);
  const [expanded, setExpanded] = useState(false);
  // Only a user toggle animates; measuring on mount or on resize snaps.
  const [interacted, setInteracted] = useState(false);

  useLayoutEffect(() => {
    const element = contentRef.current;

    if (!element) {
      return;
    }

    const measure = () => setFullHeight(element.scrollHeight);
    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [text]);

  const overflows = fullHeight !== null && fullHeight > COLLAPSED_HEIGHT_PX;

  const collapsed = overflows && !expanded;

  return (
    <div className="flex flex-col items-start gap-1">
      <motion.div
        className="relative w-full overflow-hidden"
        initial={false}
        animate={{
          height: overflows
            ? expanded
              ? (fullHeight ?? "auto")
              : COLLAPSED_HEIGHT_PX
            : "auto",
        }}
        transition={
          reduceMotion || !interacted
            ? { duration: 0 }
            : { duration: ADMIN_DURATION.standard, ease: ADMIN_EASE_OUT }
        }
      >
        <p ref={contentRef} className={className}>
          {text}
        </p>
        <div
          aria-hidden="true"
          className={cn(
            "from-background pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t to-transparent transition-opacity duration-250 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none",
            collapsed ? "opacity-100" : "opacity-0",
          )}
        />
      </motion.div>
      {overflows ? (
        <button
          type="button"
          aria-expanded={expanded}
          onClick={() => {
            setInteracted(true);
            setExpanded((value) => !value);
          }}
          className={cn(
            "text-foreground hover:bg-muted focus-visible:ring-ring -mx-2 inline-flex min-h-9 items-center gap-1 rounded-sm px-2 text-xs font-medium focus-visible:ring-2 focus-visible:outline-none",
            PRESS_CONTROL_CLASS,
          )}
        >
          {expanded ? collapseLabel : expandLabel}
          <ChevronDownIcon
            aria-hidden="true"
            className={cn(
              "size-3.5 transition-transform duration-250 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none",
              expanded && "rotate-180",
            )}
          />
        </button>
      ) : null}
    </div>
  );
}
