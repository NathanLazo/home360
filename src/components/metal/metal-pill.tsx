"use client";

import { MetalBadge, type MetalFxTheme } from "metal-fx";

import { useMetalMotion } from "./use-metal-motion";
import { cn } from "~/lib/utils";

type MetalPillProps = {
  label: string;
  /** Size multiplier on the 45×25 base badge. */
  scale?: number;
  /** Match the surface the pill sits on. */
  theme?: MetalFxTheme;
};

/**
 * Short metallic label ("Pro", "Nuevo", "Activo"). Under reduced motion,
 * without WebGL2 and on the server's first paint a static pill with the same
 * footprint stands in.
 */
export function MetalPill({
  label,
  scale = 1,
  theme = "light",
}: MetalPillProps) {
  const live = useMetalMotion();

  if (!live) {
    return (
      <span
        className={cn(
          "bg-card text-foreground inline-flex items-center justify-center rounded-full border px-2 font-medium shadow-xs",
          theme === "dark" && "dark",
        )}
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
    <MetalBadge theme={theme} scale={scale} strength={0.9}>
      {label}
    </MetalBadge>
  );
}
