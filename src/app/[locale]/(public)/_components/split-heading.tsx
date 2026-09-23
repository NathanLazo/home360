"use client";

import { Fragment, useRef } from "react";
import { motion, useInView, useReducedMotion } from "motion/react";

import { accentClass, LANDING_EASE } from "./landing-styles";
import { cn } from "~/lib/utils";

type Word = { text: string; accent: boolean };

/**
 * `*phrase*` in a message marks the serif accent. The markers are stripped;
 * everything else is plain text, so translators only learn one convention.
 */
function splitWords(text: string): Word[] {
  return text.split("*").flatMap((segment, index) =>
    segment
      .split(/\s+/)
      .filter((word) => word.length > 0)
      .map((word) => ({ text: word, accent: index % 2 === 1 })),
  );
}

type SplitHeadingProps = {
  as?: "h1" | "h2";
  id?: string;
  text: string;
  className?: string;
  /** Delay before the first word, in milliseconds. */
  delayMs?: number;
};

const WORD_STAGGER_S = 0.045;

/**
 * Masked word reveal: every word rises out of its own clipping box, in
 * reading order. Only `transform` animates; the text is in the DOM from the
 * first paint, with real spaces between words, so it reads and selects as a
 * normal heading. Under reduced motion `MotionConfig reducedMotion="user"`
 * makes the transform instant — same words, same layout, no movement.
 */
export function SplitHeading({
  as = "h2",
  id,
  text,
  className,
  delayMs = 0,
}: SplitHeadingProps) {
  const ref = useRef<HTMLHeadingElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-60px" });
  const shouldReduceMotion = useReducedMotion();
  const words = splitWords(text);
  const Tag = as;

  return (
    <Tag ref={ref} id={id} className={className}>
      {words.map((word, index) => (
        <Fragment key={`${word.text}-${index}`}>
          <span
            className={cn(
              "-my-[0.12em] inline-block overflow-hidden py-[0.12em] align-top",
              word.accent && "-mx-[0.04em] px-[0.04em]",
            )}
          >
            <motion.span
              className={cn(
                "inline-block will-change-transform",
                word.accent && accentClass,
              )}
              initial={{ transform: "translateY(110%)" }}
              animate={
                isInView
                  ? { transform: "translateY(0%)" }
                  : { transform: "translateY(110%)" }
              }
              transition={
                shouldReduceMotion
                  ? { duration: 0 }
                  : {
                      duration: 0.7,
                      ease: LANDING_EASE,
                      delay: delayMs / 1000 + index * WORD_STAGGER_S,
                    }
              }
            >
              {word.text}
            </motion.span>
          </span>
          {index < words.length - 1 ? " " : null}
        </Fragment>
      ))}
    </Tag>
  );
}
