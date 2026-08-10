"use client";

import { MotionConfig } from "motion/react";

type LandingMotionProviderProps = {
  children: React.ReactNode;
};

/**
 * Landing-only motion boundary. Children stay Server Components: they arrive
 * already rendered, so wrapping them here does not turn them into client code.
 */
export function LandingMotionProvider({
  children,
}: LandingMotionProviderProps) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
