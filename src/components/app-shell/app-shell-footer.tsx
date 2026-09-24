import type { ReactNode } from "react";

export type AppShellFooterProps = {
  /** Accessible name of the bar (already localized). */
  label: string;
  /** Leading area: contextual quick access (message bubbles, shortcuts). */
  children?: ReactNode;
  /** Trailing area: persistent utilities and, later, the agent entry point. */
  end?: ReactNode;
};

/**
 * The panel's bottom bar (36 px, desktop only): closes the rounded screen
 * and holds the quick-access lane. `data-slot="agent-dock"` marks where the
 * AI agent entry point and its chat bubbles will mount; nothing else should
 * claim that space.
 */
export function AppShellFooter({ label, children, end }: AppShellFooterProps) {
  return (
    <footer
      aria-label={label}
      className="border-border bg-background relative z-20 hidden h-9 shrink-0 items-center gap-2 border-t px-3 md:flex md:rounded-b-xl"
    >
      <div className="flex min-w-0 flex-1 [scrollbar-width:none] items-center gap-1.5 overflow-x-auto">
        {children}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {end}
        <div data-slot="agent-dock" className="flex items-center gap-1" />
      </div>
    </footer>
  );
}
