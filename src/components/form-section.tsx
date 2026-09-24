import type { ReactNode } from "react";

import { cn } from "~/lib/utils";

/**
 * A titled group inside a sheet or dialog form: fields that belong together
 * read as one unit, and the title tells the user what this stretch of the
 * form decides. Keep 2–5 fields per section; one section needs no title.
 */
export function FormSection({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      aria-label={title}
      className={cn("flex flex-col gap-4 px-4", className)}
    >
      <div className="flex flex-col gap-0.5">
        <h3 className="text-muted-foreground text-label font-mono font-medium tracking-wide uppercase">
          {title}
        </h3>
        {description ? (
          <p className="text-muted-foreground text-copy-sm text-pretty">
            {description}
          </p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

/** Thin rule between form sections; keeps the same inset as the fields. */
export function FormSectionDivider() {
  return <hr className="border-hairline mx-4 border-t" aria-hidden="true" />;
}
