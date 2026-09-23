import { CheckIcon, CopyIcon } from "lucide-react";

import { cn } from "~/lib/utils";

export type CopyStateIconProps = {
  copied: boolean;
  className?: string;
};

const iconTransition =
  "transition-[opacity,scale,filter] duration-200 ease-ui motion-reduce:transition-opacity";

/**
 * Copy → check swap for copy-to-clipboard buttons. Both icons stay mounted and
 * cross-fade (opacity + scale + blur) so the confirmation reads as one object
 * changing state instead of an icon teleporting. Under reduced motion only the
 * opacity fades.
 */
export function CopyStateIcon({ copied, className }: CopyStateIconProps) {
  return (
    <span
      aria-hidden="true"
      className={cn("relative inline-flex size-4 shrink-0", className)}
    >
      <CopyIcon
        className={cn(
          "absolute inset-0 size-4",
          iconTransition,
          copied &&
            "scale-25 opacity-0 blur-[4px] motion-reduce:scale-100 motion-reduce:blur-none",
        )}
      />
      <CheckIcon
        className={cn(
          "absolute inset-0 size-4",
          iconTransition,
          !copied &&
            "scale-25 opacity-0 blur-[4px] motion-reduce:scale-100 motion-reduce:blur-none",
        )}
      />
    </span>
  );
}
