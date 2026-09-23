import { type LucideIcon } from "lucide-react";

import { bodyClass, dataLabelClass, subheadingClass } from "./landing-styles";
import { cn } from "~/lib/utils";

type GuaranteeCardProps = {
  Icon: LucideIcon;
  title: string;
  description: string;
  /** Visible text, so the recommended option never relies on styling alone. */
  recommendedLabel?: string;
};

/** One guarantee option, sized for the marquee rail. */
export function GuaranteeCard({
  Icon,
  title,
  description,
  recommendedLabel,
}: GuaranteeCardProps) {
  const isRecommended = recommendedLabel !== undefined;

  return (
    <div
      className={cn(
        "flex h-full w-[18rem] shrink-0 flex-col gap-4 rounded-xl border p-6 sm:w-[20rem]",
        isRecommended
          ? "border-foreground bg-foreground text-background"
          : "bg-card text-card-foreground",
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <Icon aria-hidden="true" className="size-5" />
        {isRecommended ? (
          <span
            className={cn(
              dataLabelClass,
              "border-background/30 rounded-full border px-2 py-0.5",
            )}
          >
            {recommendedLabel}
          </span>
        ) : null}
      </div>
      <h3 className={subheadingClass}>{title}</h3>
      <p className={cn(bodyClass, isRecommended && "text-background/75")}>
        {description}
      </p>
    </div>
  );
}
