import { getTranslations } from "next-intl/server";

import { FeatureCard } from "./feature-card";
import { LANDING_ANCHORS, LANDING_FEATURES } from "./landing-data";
import {
  anchorOffsetClass,
  containerClass,
  displayHeadingClass,
  leadClass,
  LANDING_STAGGER_MS,
  sectionPaddingClass,
} from "./landing-styles";
import { Reveal } from "./reveal";
import { BentoGrid } from "~/components/ui/bento-grid";

/**
 * Cream band (§3) and destination of the "For businesses" anchor. These three
 * pieces are not a sequence, so they carry no step numbers (§5).
 */
export async function FeaturesSection() {
  const t = await getTranslations("landing.features");

  return (
    <section
      id={LANDING_ANCHORS.forBusiness}
      aria-labelledby="features-title"
      className={`${anchorOffsetClass} w-full bg-[var(--brand-cream)] text-[var(--brand-navy)]`}
    >
      <div className={`${containerClass} ${sectionPaddingClass}`}>
        <Reveal>
          <div className="flex max-w-2xl flex-col gap-4">
            <h2 id="features-title" className={displayHeadingClass}>
              {t("title")}
            </h2>
            <p
              className={`${leadClass} text-[color-mix(in_srgb,var(--brand-navy)_72%,transparent)]`}
            >
              {t("subtitle")}
            </p>
          </div>
        </Reveal>

        <BentoGrid className="mt-12 auto-rows-fr grid-cols-1 gap-4 lg:grid-cols-3">
          {LANDING_FEATURES.map((feature, index) => {
            const card = (
              <Reveal
                key={feature.key}
                className="h-full"
                delayMs={(index + 1) * LANDING_STAGGER_MS}
              >
                <FeatureCard
                  Icon={feature.icon}
                  title={t(`${feature.key}.title`)}
                  description={t(`${feature.key}.description`)}
                />
              </Reveal>
            );

            // The guarantees anchor lands on the card it actually describes.
            return feature.key === "realGuarantees" ? (
              <div
                key={feature.key}
                id={LANDING_ANCHORS.guarantees}
                className={`${anchorOffsetClass} h-full`}
              >
                {card}
              </div>
            ) : (
              card
            );
          })}
        </BentoGrid>
      </div>
    </section>
  );
}
