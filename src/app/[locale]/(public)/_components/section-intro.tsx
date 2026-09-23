import { displayHeadingClass, leadClass } from "./landing-styles";
import { Reveal } from "./reveal";
import { SplitHeading } from "./split-heading";
import { cn } from "~/lib/utils";

type SectionIntroProps = {
  titleId: string;
  title: string;
  subtitle: string;
  className?: string;
};

/**
 * Heading + lead shared by every section: the heading rises out of its word
 * masks, the lead blurs in right behind it.
 */
export function SectionIntro({
  titleId,
  title,
  subtitle,
  className,
}: SectionIntroProps) {
  return (
    <div className={cn("flex max-w-3xl flex-col gap-5", className)}>
      <SplitHeading id={titleId} text={title} className={displayHeadingClass} />
      <Reveal delayMs={160}>
        <p className={leadClass}>{subtitle}</p>
      </Reveal>
    </div>
  );
}
