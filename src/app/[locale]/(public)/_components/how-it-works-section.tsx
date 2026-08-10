import { getTranslations } from "next-intl/server";

import { LANDING_ANCHORS, LANDING_STEP_KEYS } from "./landing-data";
import {
  anchorOffsetClass,
  containerClass,
  displayHeadingClass,
  leadClass,
  LANDING_STAGGER_MS,
  sectionPaddingClass,
  subheadingClass,
} from "./landing-styles";
import { Reveal } from "./reveal";

/**
 * A real sequence, so it is a real ordered list (§5). The step numbers are set
 * in mono: they are data, not decoration.
 */
export async function HowItWorksSection() {
  const t = await getTranslations("landing.howItWorks");

  return (
    <section
      id={LANDING_ANCHORS.howItWorks}
      aria-labelledby="how-it-works-title"
      className={`${anchorOffsetClass} w-full bg-[color-mix(in_srgb,var(--brand-cream)_94%,var(--brand-navy))] text-[var(--brand-navy)]`}
    >
      <div className={`${containerClass} ${sectionPaddingClass}`}>
        <Reveal>
          <div className="flex max-w-2xl flex-col gap-4">
            <h2 id="how-it-works-title" className={displayHeadingClass}>
              {t("title")}
            </h2>
            <p
              className={`${leadClass} text-[color-mix(in_srgb,var(--brand-navy)_72%,transparent)]`}
            >
              {t("subtitle")}
            </p>
          </div>
        </Reveal>

        <ol className="mt-12 grid grid-cols-1 gap-8 lg:grid-cols-3 lg:gap-10">
          {LANDING_STEP_KEYS.map((step, index) => (
            <li key={step} className="h-full">
              <Reveal
                delayMs={(index + 1) * LANDING_STAGGER_MS}
                className="h-full"
              >
                <div className="flex h-full flex-col gap-3 border-t-2 border-[color-mix(in_srgb,var(--brand-gold)_60%,transparent)] pt-5">
                  <span
                    aria-hidden="true"
                    className="flex size-9 items-center justify-center rounded-full bg-[var(--brand-navy)] font-mono text-sm font-semibold text-[var(--brand-cream)] tabular-nums"
                  >
                    {step}
                  </span>
                  <h3 className={subheadingClass}>
                    {t(`steps.${step}.title`)}
                  </h3>
                  <p className="text-[0.9375rem] leading-relaxed text-pretty text-[color-mix(in_srgb,var(--brand-navy)_72%,transparent)]">
                    {t(`steps.${step}.description`)}
                  </p>
                </div>
              </Reveal>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
