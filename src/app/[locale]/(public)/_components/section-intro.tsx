import {
  dataLabelClass,
  displayHeadingClass,
  leadClass,
} from "./landing-styles";
import { Reveal } from "./reveal";
import { SplitHeading } from "./split-heading";
import { cn } from "~/lib/utils";

type SectionIntroProps = {
  titleId: string;
  title: string;
  subtitle: string;
  /**
   * Geist Mono eyebrow for technical sections only. Budget: at most one
   * eyebrow per three sections across the landing (the hero announcement
   * counts as one); today only the metrics band uses it.
   */
  eyebrow?: string;
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
  eyebrow,
  className,
}: SectionIntroProps) {
  return (
    <div className={cn("flex max-w-3xl flex-col gap-4", className)}>
      {eyebrow ? (
        <Reveal>
          <p className={cn(dataLabelClass, "text-muted-foreground")}>
            {eyebrow}
          </p>
        </Reveal>
      ) : null}
      <SplitHeading id={titleId} text={title} className={displayHeadingClass} />
      <Reveal delayMs={160}>
        <p className={leadClass}>{subtitle}</p>
      </Reveal>
    </div>
  );
}
