import type { ReactNode } from "react";

export type AppShellFooterProps = {
  /** Accessible name of the bar (already localized). */
  label: string;
  /** Leading area: persistent utilities (language, status). */
  children?: ReactNode;
  /** Trailing area: the assistant dock (open chats, agent, history). */
  end?: ReactNode;
};

/**
 * The panel's bottom bar (36 px, desktop only): closes the rounded screen
 * and carries the quick-access lane. Utilities sit at the start; the
 * assistant dock owns the end, where its bubbles rise from.
 */
export function AppShellFooter({ label, children, end }: AppShellFooterProps) {
  return (
    <footer
      aria-label={label}
      className="border-border bg-background relative z-20 hidden h-9 shrink-0 items-center gap-2 border-t px-2 md:flex md:rounded-b-xl"
    >
      <div className="flex shrink-0 items-center gap-1">{children}</div>
      <div className="flex min-w-0 flex-1 items-center justify-end gap-1.5">
        {end}
      </div>
    </footer>
  );
}
