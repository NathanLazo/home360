import { CheckIcon, StarIcon } from "lucide-react";

import {
  eyebrowClass,
  focusRingOnCream,
  subheadingClass,
} from "./landing-styles";
import { Button } from "~/components/ui/button";
import { Link } from "~/i18n/navigation";

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
    <div
      className={`flex h-full flex-col gap-6 rounded-lg bg-white p-6 transition-[box-shadow,border-color] duration-300 ${
        highlighted
          ? "border-2 border-[var(--brand-gold)] shadow-[0_18px_44px_-28px_rgb(13_27_42/0.5)]"
          : "border border-[color-mix(in_srgb,var(--brand-navy)_14%,transparent)]"
      }`}
    >
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className={`${subheadingClass} text-[var(--brand-navy)]`}>
            {name}
          </h3>
          {highlighted ? (
            <p
              className={`${eyebrowClass} inline-flex items-center gap-1.5 rounded-full bg-[var(--brand-navy)] px-2.5 py-1 text-[var(--brand-cream)]`}
            >
              <StarIcon aria-hidden="true" className="size-3" />
              {recommendedLabel}
            </p>
          ) : null}
        </div>

        <p className="flex items-baseline gap-1 text-[var(--brand-navy)]">
          <span className="font-mono text-4xl font-semibold tracking-[-0.02em] tabular-nums">
            {price}
          </span>
          <span className="text-sm text-[color-mix(in_srgb,var(--brand-navy)_65%,transparent)]">
            {perMonth}
          </span>
        </p>

        <p
          className={`${eyebrowClass} text-[color-mix(in_srgb,var(--brand-navy)_70%,transparent)]`}
        >
          {commission}
        </p>
      </div>

      <ul className="flex flex-1 flex-col gap-3">
        {features.map((feature) => (
          <li
            key={feature}
            className="flex items-start gap-2.5 text-[0.9375rem] leading-relaxed text-[color-mix(in_srgb,var(--brand-navy)_78%,transparent)]"
          >
            <CheckIcon
              aria-hidden="true"
              className="mt-0.5 size-4 shrink-0 text-[var(--brand-navy)]"
            />
            {feature}
          </li>
        ))}
      </ul>

      <Button
        asChild
        className={`h-12 rounded-md px-6 text-base font-medium active:scale-[0.98] ${focusRingOnCream} ${
          highlighted
            ? "bg-[var(--brand-navy)] text-[var(--brand-cream)] hover:bg-[color-mix(in_srgb,var(--brand-navy)_88%,white)]"
            : "border border-[var(--brand-navy)] bg-transparent text-[var(--brand-navy)] shadow-none hover:bg-[color-mix(in_srgb,var(--brand-navy)_8%,transparent)]"
        }`}
      >
        <Link href="/register">
          {ctaLabel}
          {/* Three identical CTAs would be ambiguous out of context. */}
          <span className="sr-only"> {name}</span>
        </Link>
      </Button>
    </div>
  );
}
