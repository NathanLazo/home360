import { CheckIcon } from "lucide-react";

import { LandingBeam } from "./landing-beam";
import {
  dataLabelClass,
  inkSurfaceClass,
  LANDING_BEAM_RADIUS,
  subheadingClass,
} from "./landing-styles";
import { MetalRecommendedPill } from "./metal-recommended-pill";
import { SpotlightCard } from "./spotlight-card";
import { Button } from "~/components/ui/button";
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
 * A plan: canvas card on stacked shadows, 12 px radius. The recommended one
 * is polarity-flipped to ink (the light-scope ink with `.dark` tokens for its
 * content), carries the white CTA and wears the live silver ring on its
 * label. A quiet mono beam frames the whole card: the metal marks the label,
 * the beam marks the card, and neither ever wraps the other's element.
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
  const card = (
    <SpotlightCard
      lift={!highlighted}
      className={cn(
        "flex h-full flex-col gap-8 p-7",
        highlighted && cn(inkSurfaceClass, "shadow-float"),
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
          <span className="text-copy-sm text-muted-foreground">{perMonth}</span>
        </p>

        <p className={cn(dataLabelClass, "text-muted-foreground")}>
          {commission}
        </p>
      </div>

      <ul className="flex flex-1 flex-col gap-3 border-t pt-6">
        {features.map((feature) => (
          <li
            key={feature}
            className="text-copy text-foreground/85 flex items-start gap-2.5"
          >
            <CheckIcon
              aria-hidden="true"
              className="text-foreground mt-1 size-4 shrink-0"
            />
            {feature}
          </li>
        ))}
      </ul>

      <Button
        asChild
        variant="secondary"
        size="pill"
        className={cn(
          "w-full",
          // White CTA on the ink card: `foreground` is near-white inside the
          // `.dark` scope, `background` near-black (≥ 15:1).
          highlighted &&
            "bg-foreground text-background hover:bg-foreground/90 hover:text-background border-transparent",
        )}
      >
        <Link href="/register">
          {ctaLabel}
          {/* Three identical CTAs would be ambiguous out of context. */}
          <span className="sr-only"> {name}</span>
        </Link>
      </Button>
    </SpotlightCard>
  );

  if (!highlighted) return card;

  return (
    <LandingBeam
      size="md"
      colorVariant="mono"
      theme="dark"
      strength={0.7}
      duration={4.2}
      borderRadius={LANDING_BEAM_RADIUS.lg}
      allowOverflow
      // The frame lifts with the card so the beam never slides off its edge.
      className="h-full transition-[translate] duration-200 ease-out hover:-translate-y-0.5 motion-reduce:transition-none motion-reduce:hover:translate-y-0"
    >
      {card}
    </LandingBeam>
  );
}
