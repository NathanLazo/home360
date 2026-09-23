import { VideoIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { GuaranteeCard } from "./guarantee-card";
import { GuaranteeMarquee } from "./guarantee-marquee";
import { LANDING_ANCHORS, LANDING_GUARANTEES } from "./landing-data";
import {
  anchorOffsetClass,
  bodyClass,
  containerClass,
  sectionPaddingClass,
  subheadingClass,
} from "./landing-styles";
import { Reveal } from "./reveal";
import { SectionIntro } from "./section-intro";
import { cn } from "~/lib/utils";

/**
 * Destination of the "Guarantees" anchor: the mandatory recording that sits
 * under every option, then the five options on a rail.
 */
export async function GuaranteesSection() {
  const t = await getTranslations("landing.guaranteeTypes");

  const items = LANDING_GUARANTEES.map((guarantee) => ({
    key: guarantee.key,
    node: (
      <GuaranteeCard
        Icon={guarantee.icon}
        title={t(`types.${guarantee.key}.title`)}
        description={t(`types.${guarantee.key}.description`)}
        recommendedLabel={guarantee.recommended ? t("recommended") : undefined}
      />
    ),
  }));

  return (
    <section
      id={LANDING_ANCHORS.guarantees}
      aria-labelledby="guarantees-title"
      className={cn(anchorOffsetClass, "w-full")}
    >
      <div
        className={cn(containerClass, sectionPaddingClass, "pb-12 lg:pb-16")}
      >
        <div className="grid grid-cols-1 items-end gap-10 lg:grid-cols-[1.2fr_1fr]">
          <SectionIntro
            titleId="guarantees-title"
            title={t("title")}
            subtitle={t("subtitle")}
          />
          <Reveal delayMs={200}>
            <div className="bg-card flex gap-4 rounded-xl border p-5">
              <span
                aria-hidden="true"
                className="bg-foreground text-background flex size-10 shrink-0 items-center justify-center rounded-full"
              >
                <VideoIcon className="size-[1.125rem]" />
              </span>
              <div className="flex flex-col gap-1.5">
                <h3 className={subheadingClass}>{t("recording.title")}</h3>
                <p className={bodyClass}>{t("recording.description")}</p>
              </div>
            </div>
          </Reveal>
        </div>
      </div>

      <Reveal className="pb-24 lg:pb-32" delayMs={120}>
        <div className="mx-auto w-full max-w-[90rem] px-4 motion-reduce:max-w-6xl sm:px-6 lg:px-8">
          <GuaranteeMarquee label={t("listLabel")} items={items} />
        </div>
      </Reveal>
    </section>
  );
}
