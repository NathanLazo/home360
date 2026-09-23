import { getLocale, getTranslations } from "next-intl/server";

import { LANDING_ANCHORS, LANDING_PLANS } from "./landing-data";
import { formatMxnFromCents } from "./landing-money";
import {
  anchorOffsetClass,
  containerClass,
  LANDING_STAGGER_MS,
  sectionPaddingClass,
} from "./landing-styles";
import { PricingCard } from "./pricing-card";
import { Reveal } from "./reveal";
import { SectionIntro } from "./section-intro";
import { cn } from "~/lib/utils";

/**
 * Destination of the "Pricing" anchor. The plans mirror the seed through
 * `LANDING_PLANS`; there is no database call on the landing.
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
      className={cn(anchorOffsetClass, "bg-card w-full border-t")}
    >
      <div className={cn(containerClass, sectionPaddingClass)}>
        <SectionIntro
          titleId="pricing-title"
          title={t("title")}
          subtitle={t("subtitle")}
        />

        <div className="mt-14 grid grid-cols-1 items-stretch gap-4 lg:grid-cols-3">
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
