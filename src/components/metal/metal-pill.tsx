"use client";

import { MetalBadge } from "metal-fx";

import { useMetalMotion } from "./use-metal-motion";

type MetalPillProps = {
  label: string;
  /** Size multiplier on the 45×25 base badge. */
  scale?: number;
};

/**
 * Short metallic label ("Pro", "Nuevo", "Activo"). Under reduced motion,
 * without WebGL2 and on the server's first paint a static pill with the same
 * footprint stands in.
 */
export function MetalPill({ label, scale = 1 }: MetalPillProps) {
  const live = useMetalMotion();

  if (!live) {
    return (
      <span
        className="bg-card text-foreground inline-flex items-center justify-center rounded-full border px-2 font-medium shadow-xs"
        style={{
          height: 25 * scale,
          minWidth: 45 * scale,
          fontSize: 12.222 * scale,
        }}
      >
        {label}
      </span>
    );
  }

  return (
    <MetalBadge theme="light" scale={scale} strength={0.9}>
      {label}
    </MetalBadge>
  );
}
