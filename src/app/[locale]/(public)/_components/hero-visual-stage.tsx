"use client";

import { useRef } from "react";
import { motion, useScroll, useSpring, useTransform } from "motion/react";

import { useLandingReducedMotion } from "./use-landing-reduced-motion";

type HeroVisualStageProps = {
  children: React.ReactNode;
};

/**
 * Scroll-linked stage for the hero visual: it starts slightly tilted back and
 * scaled down, and settles flat and full-size as the page scrolls it into the
 * reading position — the product "coming forward". Transform only, smoothed
 * with a stiff spring so wheel steps don't read as jumps.
 *
 * Under reduced motion the visual renders flat and still, same box.
 */
export function HeroVisualStage({ children }: HeroVisualStageProps) {
  const ref = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = useLandingReducedMotion();
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "center center"],
  });
  const progress = useSpring(scrollYProgress, {
    stiffness: 260,
    damping: 40,
    mass: 0.4,
  });
  const scale = useTransform(progress, [0, 1], [0.9, 1]);
  const rotateX = useTransform(progress, [0, 1], [10, 0]);
  const y = useTransform(progress, [0, 1], [48, 0]);
  const transform = useTransform(
    [scale, rotateX, y],
    ([latestScale, latestRotate, latestY]: number[]) =>
      `perspective(1600px) translate3d(0, ${latestY ?? 0}px, 0) rotateX(${latestRotate ?? 0}deg) scale(${latestScale ?? 1})`,
  );

  return (
    <div ref={ref} className="relative">
      <motion.div
        style={prefersReducedMotion ? undefined : { transform }}
        className="origin-[50%_0%] will-change-transform"
      >
        {children}
      </motion.div>
    </div>
  );
}
