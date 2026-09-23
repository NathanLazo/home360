import type { ReactNode } from "react";

import { GlassDock } from "~/components/glass";

/**
 * Sticky save bar for sheet forms: a Liquid Glass panel the fields scroll
 * under, carrying cancel + the live-metal submit (DESIGN.md §6 — the screen's
 * signature while the sheet is open). Place it as the last child of the
 * scrolling form so it pins to the bottom edge.
 */
export function SheetFormDock({ children }: { children: ReactNode }) {
  return (
    <div className="sticky bottom-0 z-10 mt-auto px-4 pt-2 pb-4">
      <GlassDock shape="panel" className="justify-end">
        {children}
      </GlassDock>
    </div>
  );
}
