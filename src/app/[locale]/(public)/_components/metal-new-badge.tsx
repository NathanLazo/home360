"use client";

import { MetalBadge } from "metal-fx";

import { MotionSafe } from "./motion-safe";

type MetalNewBadgeProps = {
  label: string;
};

/**
 * "New" pill of the hero announcement. The metal version is a live shader,
 * so under reduced motion (and on the server's first paint) a static pill with
 * the same footprint and label stands in.
 */
export function MetalNewBadge({ label }: MetalNewBadgeProps) {
  return (
    <MotionSafe
      fallback={
        <span className="bg-card text-foreground inline-flex h-[25px] min-w-[45px] items-center justify-center rounded-full border px-2 text-xs font-medium">
          {label}
        </span>
      }
    >
      <MetalBadge theme="light">{label}</MetalBadge>
    </MotionSafe>
  );
}
