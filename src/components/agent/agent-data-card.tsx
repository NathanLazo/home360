"use client";

import { useState, type ReactNode } from "react";
import { ChevronRightIcon } from "lucide-react";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "~/components/ui/collapsible";
import { cn } from "~/lib/utils";

export type AgentDataCardProps = {
  title: string;
  /** Compact figure shown while collapsed (e.g. "12 retiros · $45,300.00"). */
  summary?: string;
  defaultOpen?: boolean;
  children: ReactNode;
  className?: string;
};

/**
 * Collapsed-by-default container for large tool data (tables, KPI grids) so
 * dashboards never crowd the thread: the header always shows the summary and
 * the body only occupies space once the user expands it.
 */
export function AgentDataCard({
  title,
  summary,
  defaultOpen = false,
  children,
  className,
}: AgentDataCardProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      className={cn("bg-card w-full rounded-lg border", className)}
    >
      <CollapsibleTrigger className="focus-visible:ring-ring flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left focus-visible:ring-2 focus-visible:outline-none">
        <ChevronRightIcon
          className={cn(
            "text-muted-foreground size-3.5 shrink-0 transition-transform motion-reduce:transition-none",
            open && "rotate-90",
          )}
          aria-hidden="true"
        />
        <span className="text-foreground/90 truncate text-xs font-medium">
          {title}
        </span>
        {summary ? (
          <span className="text-muted-foreground ml-auto shrink-0 text-[11px] tabular-nums">
            {summary}
          </span>
        ) : null}
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="max-h-80 overflow-auto border-t px-3 py-2.5">
          {children}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
