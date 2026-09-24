import type { ReactNode } from "react";

import { Separator } from "~/components/ui/separator";
import { SidebarTrigger } from "~/components/ui/sidebar";

export type AppShellHeaderProps = {
  toggleSidebarLabel: string;
  /** Breadcrumb (and any inline chrome next to it). */
  children: ReactNode;
  /** Right-aligned controls: filters, bell, user menu. */
  actions?: ReactNode;
};

/**
 * One thin row of chrome at the top of the panel (40 px on desktop): trigger,
 * hairline, breadcrumb, and the screen's controls pushed to the end. Content
 * scrolls under it; the frosted canvas keeps the row legible without adding
 * a second surface inside the panel.
 */
export function AppShellHeader({
  toggleSidebarLabel,
  children,
  actions,
}: AppShellHeaderProps) {
  return (
    <header className="border-border bg-background/92 supports-[backdrop-filter]:bg-background/85 z-20 flex h-11 shrink-0 items-center border-b backdrop-blur-xl md:h-10">
      <div className="flex w-full items-center gap-2 px-2.5 sm:px-3">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <SidebarTrigger
            aria-label={toggleSidebarLabel}
            className="-ml-1 size-9 shrink-0 md:size-7"
          />
          <Separator
            orientation="vertical"
            className="data-[orientation=vertical]:h-4"
          />
          <div className="flex min-w-0 items-center gap-1.5">{children}</div>
        </div>
        {actions ? (
          <div className="flex shrink-0 items-center gap-1 sm:gap-1.5">
            {actions}
          </div>
        ) : null}
      </div>
    </header>
  );
}
