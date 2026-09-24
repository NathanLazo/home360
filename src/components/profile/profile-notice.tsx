import type { ReactNode } from "react";
import { InfoIcon } from "lucide-react";

import { cn } from "~/lib/utils";

/**
 * Inline notice for a section that cannot act (read-only session, missing
 * gateway key). Warning family: soft fill, deep text, icon as second cue.
 */
export function ProfileNotice({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <p
      role="note"
      className={cn(
        "bg-warning-soft text-warning-deep text-copy-sm flex items-start gap-2.5 rounded-xl px-4 py-3",
        className,
      )}
    >
      <InfoIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      <span>{children}</span>
    </p>
  );
}
