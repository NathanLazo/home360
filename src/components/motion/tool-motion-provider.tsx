"use client";

import type { ReactNode } from "react";
import { MotionConfig } from "motion/react";

/**
 * Motion boundary for the tool shells (dashboard, admin, corporate): every
 * motion/react animation inside (charts, tooltips, indicators) follows the
 * OS reduced-motion setting — transforms drop, opacity stays. Children stay
 * Server Components.
 */
export function ToolMotionProvider({ children }: { children: ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
