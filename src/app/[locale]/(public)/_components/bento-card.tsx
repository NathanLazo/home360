import { type LucideIcon } from "lucide-react";

import { bodyClass, subheadingClass } from "./landing-styles";
import { SpotlightCard } from "./spotlight-card";
import { cn } from "~/lib/utils";

type BentoCardProps = {
  Icon: LucideIcon;
  title: string;
  description: string;
  /** Illustration or supporting content under the copy. */
  children?: React.ReactNode;
  className?: string;
};

/**
 * One tile of the features bento: a statement, not a control. It carries the
 * spotlight and the hover lift; any link inside brings its own focus ring.
 */
export function BentoCard({
  Icon,
  title,
  description,
  children,
  className,
}: BentoCardProps) {
  return (
    <SpotlightCard className={cn("flex h-full flex-col", className)}>
      <div className="flex flex-col gap-3 p-6 sm:p-7">
        <h3 className={cn(subheadingClass, "flex items-center gap-2.5")}>
          <Icon aria-hidden="true" className="size-[1.125rem] shrink-0" />
          {title}
        </h3>
        <p className={cn(bodyClass, "max-w-[52ch]")}>{description}</p>
      </div>
      {children ? (
        <div className="mt-auto px-6 pb-6 sm:px-7 sm:pb-7">{children}</div>
      ) : null}
    </SpotlightCard>
  );
}
