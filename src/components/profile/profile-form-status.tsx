"use client";

import { cn } from "~/lib/utils";

/**
 * "Unsaved changes" line next to a form's save button. The dot fades and
 * settles in when the form turns dirty (200 ms, opacity + scale); the text is
 * the primary cue and announces politely, so the state never rides on color.
 */
export function ProfileFormStatus({
  dirty,
  dirtyLabel,
  cleanLabel,
}: {
  dirty: boolean;
  dirtyLabel: string;
  cleanLabel: string;
}) {
  return (
    <p
      className="text-muted-foreground text-copy-sm flex items-center gap-2"
      aria-live="polite"
    >
      <span
        aria-hidden="true"
        className={cn(
          "bg-warning size-2 shrink-0 rounded-full transition-[opacity,scale] duration-200 ease-out motion-reduce:transition-opacity",
          dirty ? "scale-100 opacity-100" : "scale-50 opacity-0",
        )}
      />
      {dirty ? dirtyLabel : cleanLabel}
    </p>
  );
}
