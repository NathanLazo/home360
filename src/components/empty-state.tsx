import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

export type EmptyStateProps = {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  /** Heading level; use "h3" when the state sits under a section `h2`. */
  headingLevel?: "h2" | "h3";
};

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  headingLevel: Heading = "h2",
}: EmptyStateProps) {
  return (
    <div className="bg-card border-hairline-strong/60 flex min-h-64 flex-col items-center justify-center gap-4 rounded-2xl border border-dashed p-8 text-center">
      {Icon ? (
        <div className="bg-canvas-soft text-muted-foreground shadow-hairline flex size-12 items-center justify-center rounded-full [&_svg]:size-5">
          <Icon aria-hidden="true" />
        </div>
      ) : null}
      <div className="flex max-w-md flex-col gap-1">
        <Heading className="text-display-sm text-balance">{title}</Heading>
        {description ? (
          <p className="text-muted-foreground text-copy-sm text-pretty">
            {description}
          </p>
        ) : null}
      </div>
      {action}
    </div>
  );
}
