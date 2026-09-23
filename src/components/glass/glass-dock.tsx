"use client";

import type { ReactNode } from "react";

import { GlassSurface, type GlassSurfaceProps } from "./glass-surface";
import { cn } from "~/lib/utils";

export type GlassDockProps = Omit<GlassSurfaceProps, "radius"> & {
  /**
   * The one liquid-metal action the dock carries, e.g.
   * `<Button size="pill-sm" metal="live">Guardar</Button>`. Rendered last,
   * after the dock's secondary content.
   */
  action?: ReactNode;
  /** `pill` for nav bars and toolbars; `panel` (12 px) for save bars. */
  shape?: "pill" | "panel";
};

/**
 * The HOME360 signature: a Liquid Glass container holding a liquid-metal
 * primary action. Use it for floating/sticky chrome — the landing nav bar, a
 * sticky save bar, a floating toolbar. At most once per screen.
 */
export function GlassDock({
  children,
  action,
  shape = "pill",
  className,
  ...rest
}: GlassDockProps) {
  return (
    <GlassSurface
      radius={shape === "pill" ? "pill" : "lg"}
      className={cn(
        "flex items-center gap-2",
        shape === "pill" ? "p-1.5 pl-4" : "p-3",
        className,
      )}
      {...rest}
    >
      {children}
      {action ? <div className="ml-auto flex shrink-0">{action}</div> : null}
    </GlassSurface>
  );
}
