import type { ReactNode } from "react";

import { GlassDock } from "~/components/glass";

/**
 * Sticky save bar for sheet forms: a Liquid Glass panel the fields scroll
 * under, carrying cancel + the live-metal submit (DESIGN.md §6 — the screen's
 * signature while the sheet is open). Place it as the last child of the
 * scrolling form so it pins to the bottom edge. On phones both actions
 * stretch to equal halves so a thumb lands on either without aiming.
 */
export function SheetFormDock({ children }: { children: ReactNode }) {
  return (
    <div className="sticky bottom-0 z-10 mt-auto px-4 pt-2 pb-[max(1rem,env(safe-area-inset-bottom))]">
      <GlassDock
        shape="panel"
        className="justify-end max-sm:*:flex-1 max-sm:[&_[data-slot=button]]:w-full"
      >
        {children}
      </GlassDock>
    </div>
  );
}
