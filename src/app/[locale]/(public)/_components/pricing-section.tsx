import { getLocale, getTranslations } from "next-intl/server";

import { LANDING_ANCHORS, LANDING_PLANS } from "./landing-data";
import { formatMxnFromCents } from "./landing-money";
import {
  anchorOffsetClass,
  containerClass,
  displayHeadingClass,
  leadClass,
  LANDING_STAGGER_MS,
  sectionPaddingClass,
} from "./landing-styles";
import { PricingCard } from "./pricing-card";
import { Reveal } from "./reveal";

/**
 * Cream band and destination of the "Pricing" anchor. The plans mirror the
 * seed through `LANDING_PLANS`; there is no database call on the landing.
 */
export async function PricingSection() {
  const t = await getTranslations("landing.pricing");
  const locale = await getLocale();

  function readFeatures(planCode: string): string[] {
    const raw: unknown = t.raw(`plans.${planCode}.features`);
    return Array.isArray(raw)
      ? raw.filter((item): item is string => typeof item === "string")
      : [];
  }

  return (
    <section
      id={LANDING_ANCHORS.pricing}
      aria-labelledby="pricing-title"
      className={`${anchorOffsetClass} w-full bg-[var(--brand-cream)] text-[var(--brand-navy)]`}
    >
      <div className={`${containerClass} ${sectionPaddingClass}`}>
        <Reveal>
          <div className="flex max-w-2xl flex-col gap-4">
            <h2 id="pricing-title" className={displayHeadingClass}>
              {t("title")}
            </h2>
            <p
              className={`${leadClass} text-[color-mix(in_srgb,var(--brand-navy)_72%,transparent)]`}
            >
              {t("subtitle")}
            </p>
          </div>
        </Reveal>

        <div className="mt-12 grid grid-cols-1 items-stretch gap-6 lg:grid-cols-3">
          {LANDING_PLANS.map((plan, index) => (
            <Reveal
              key={plan.code}
              className="h-full"
              delayMs={(index + 1) * LANDING_STAGGER_MS}
            >
              <PricingCard
                name={t(`plans.${plan.code}.name`)}
                price={formatMxnFromCents(locale, plan.priceCents)}
                perMonth={t("perMonth")}
                commission={t("commission", { pct: plan.commissionPct })}
                features={readFeatures(plan.code)}
                ctaLabel={t("cta")}
                recommendedLabel={t("recommended")}
                highlighted={plan.highlighted}
              />
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
