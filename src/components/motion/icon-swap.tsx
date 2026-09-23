import type { ReactNode } from "react";

import { cn } from "~/lib/utils";

export type IconSwapProps = {
  /** Which icon is visible: `false` shows `from`, `true` shows `to`. */
  swapped: boolean;
  from: ReactNode;
  to: ReactNode;
  className?: string;
};

const ICON_CLASSES =
  "col-start-1 row-start-1 flex items-center justify-center transition-[opacity,filter,scale] duration-250 ease-in-out motion-reduce:transition-none data-[visible=false]:scale-25 data-[visible=false]:opacity-0 data-[visible=false]:blur-[2px]";

/**
 * transitions.dev icon swap: both icons share one grid cell and cross-fade
 * with blur + scale (250 ms, ease-in-out). Decorative only — the owning
 * control keeps its accessible name.
 */
export function IconSwap({ swapped, from, to, className }: IconSwapProps) {
  return (
    <span
      aria-hidden="true"
      className={cn("relative inline-grid place-items-center", className)}
    >
      <span data-visible={!swapped} className={ICON_CLASSES}>
        {from}
      </span>
      <span data-visible={swapped} className={ICON_CLASSES}>
        {to}
      </span>
    </span>
  );
}
