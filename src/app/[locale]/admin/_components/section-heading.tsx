import type { ReactNode } from "react";

/**
 * Uniform section header for admin pages: an `h2` with an optional muted
 * description and a trailing action (usually a "view all" link), baseline
 * aligned so every section starts on the same rhythm.
 */
export function SectionHeading({
  id,
  title,
  description,
  action,
}: {
  id?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
      <div className="flex min-w-0 flex-col gap-1">
        <h2 id={id} className="text-display-sm text-balance">
          {title}
        </h2>
        {description ? (
          <p className="text-muted-foreground text-copy-sm">{description}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}
