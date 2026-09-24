import type { ComponentProps } from "react";

import { SidebarInset } from "~/components/ui/sidebar";
import { cn } from "~/lib/utils";

/**
 * The tool "screen": a rounded panel floating on the sidebar canvas, with its
 * own header, scroll region and footer. It never grows past the viewport, so
 * the page scrolls inside the panel and the rounded corners stay on screen.
 * On mobile the panel is full-bleed (the sidebar becomes a sheet).
 */
export function AppShellInset({
  className,
  ...props
}: ComponentProps<typeof SidebarInset>) {
  return (
    <SidebarInset
      className={cn(
        "h-dvh min-w-0 overflow-hidden",
        "md:peer-data-[variant=inset]:h-[calc(100svh-1rem)]",
        "md:peer-data-[variant=inset]:border-border md:peer-data-[variant=inset]:border",
        "md:peer-data-[variant=inset]:shadow-md",
        className,
      )}
      {...props}
    />
  );
}
