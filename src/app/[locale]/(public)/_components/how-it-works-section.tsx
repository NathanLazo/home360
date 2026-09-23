import { getTranslations } from "next-intl/server";

import { LANDING_ANCHORS, LANDING_STEP_KEYS } from "./landing-data";
import {
  anchorOffsetClass,
  bodyClass,
  containerClass,
  LANDING_STAGGER_MS,
  sectionPaddingClass,
  subheadingClass,
} from "./landing-styles";
import { Reveal } from "./reveal";
import { SectionIntro } from "./section-intro";
import { StepTrack } from "./step-track";
import { cn } from "~/lib/utils";

/**
 * A real sequence, so it is a real ordered list and the numbers are earned.
 * The joining line fills with the scroll.
 */
export async function HowItWorksSection() {
  const t = await getTranslations("landing.howItWorks");

  return (
    <section
      id={LANDING_ANCHORS.howItWorks}
      aria-labelledby="how-it-works-title"
      className={cn(anchorOffsetClass, "bg-canvas w-full border-t")}
    >
      <div className={cn(containerClass, sectionPaddingClass)}>
        <SectionIntro
          titleId="how-it-works-title"
          title={t("title")}
          subtitle={t("subtitle")}
        />

        <div className="relative mt-14">
          <StepTrack />
          <ol className="grid grid-cols-1 gap-12 lg:grid-cols-3 lg:gap-10">
            {LANDING_STEP_KEYS.map((step, index) => (
              <li key={step}>
                <Reveal delayMs={(index + 1) * LANDING_STAGGER_MS}>
                  <div className="flex flex-col gap-4">
                    <span
                      aria-hidden="true"
                      className="bg-canvas shadow-subtle relative z-10 flex size-9 items-center justify-center rounded-full font-mono text-sm font-medium tabular-nums"
                    >
                      {step}
                    </span>
                    <h3 className={subheadingClass}>
                      {t(`steps.${step}.title`)}
                    </h3>
                    <p className={cn(bodyClass, "max-w-[40ch]")}>
                      {t(`steps.${step}.description`)}
                    </p>
                  </div>
                </Reveal>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
