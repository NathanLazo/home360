"use client";

import { type Variants } from "motion/react";

import { LANDING_EASE, leadClass } from "./landing-styles";
import { TextAnimate } from "~/components/ui/text-animate";
import { cn } from "~/lib/utils";

type HeroSubtitleProps = {
  text: string;
  className?: string;
};

const BLUR_IN_WORD: Variants = {
  hidden: { opacity: 0, filter: "blur(10px)" },
  show: {
    opacity: 1,
    filter: "blur(0px)",
    transition: { duration: 0.6, ease: LANDING_EASE },
  },
  exit: { opacity: 0, filter: "blur(10px)", transition: { duration: 0.2 } },
};

/**
 * Staggered blur-in, word by word, following the headline's masked rise.
 * `TextAnimate` renders the plain paragraph under reduced motion.
 */
export function HeroSubtitle({ text, className }: HeroSubtitleProps) {
  return (
    <TextAnimate
      as="p"
      by="word"
      once
      startOnView={false}
      delay={0.42}
      duration={0.5}
      variants={BLUR_IN_WORD}
      className={cn(leadClass, className)}
    >
      {text}
    </TextAnimate>
  );
}
