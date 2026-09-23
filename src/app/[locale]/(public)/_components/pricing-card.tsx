import { CheckIcon } from "lucide-react";

import {
  dataLabelClass,
  focusRingClass,
  pressClass,
  subheadingClass,
} from "./landing-styles";
import { MetalRecommendedPill } from "./metal-recommended-pill";
import { SpotlightCard } from "./spotlight-card";
import { Link } from "~/i18n/navigation";
import { cn } from "~/lib/utils";

type PricingCardProps = {
  name: string;
  /** Already formatted in MXN from cents by the section. */
  price: string;
  perMonth: string;
  commission: string;
  features: readonly string[];
  ctaLabel: string;
  /** Visible text for the recommended plan: color is never the only cue. */
  recommendedLabel: string;
  highlighted: boolean;
};

/**
 * A plan. The recommended one is the same card inverted through `.dark` — the
 * zinc dark tokens, not a special palette — and wears the silver ring on its
 * label.
 */
export function PricingCard({
  name,
  price,
  perMonth,
  commission,
  features,
  ctaLabel,
  recommendedLabel,
  highlighted,
}: PricingCardProps) {
  return (
    <SpotlightCard
      className={cn(
        "flex h-full flex-col gap-8 p-7",
        highlighted
          ? "dark border-foreground/20 bg-background"
          : "bg-background",
      )}
    >
      <div className="flex flex-col gap-5">
        <div className="flex min-h-7 flex-wrap items-center justify-between gap-2">
          <h3 className={subheadingClass}>{name}</h3>
          {highlighted ? (
            <MetalRecommendedPill label={recommendedLabel} />
          ) : null}
        </div>

        <p className="flex items-baseline gap-1.5">
          <span className="font-mono text-5xl font-medium tracking-[-0.04em] tabular-nums">
            {price}
          </span>
          <span className="text-muted-foreground text-sm">{perMonth}</span>
        </p>

        <p className={cn(dataLabelClass, "text-muted-foreground")}>
          {commission}
        </p>
      </div>

      <ul className="flex flex-1 flex-col gap-3 border-t pt-6">
        {features.map((feature) => (
          <li
            key={feature}
            className="text-foreground/85 flex items-start gap-2.5 text-[0.9375rem] leading-relaxed"
          >
            <CheckIcon
              aria-hidden="true"
              className="text-foreground mt-1 size-4 shrink-0"
            />
            {feature}
          </li>
        ))}
      </ul>

      <Link
        href="/register"
        className={cn(
          "inline-flex h-12 items-center justify-center rounded-full px-6 text-base font-medium",
          pressClass,
          focusRingClass,
          highlighted
            ? "bg-primary text-primary-foreground hover:bg-primary/90"
            : "bg-card text-foreground hover:bg-foreground/5 border",
        )}
      >
        {ctaLabel}
        {/* Three identical CTAs would be ambiguous out of context. */}
        <span className="sr-only"> {name}</span>
      </Link>
    </SpotlightCard>
  );
}
