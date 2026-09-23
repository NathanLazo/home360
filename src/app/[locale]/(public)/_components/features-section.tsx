import { ArrowRightIcon } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";

import { BentoCard } from "./bento-card";
import { DiagnosisSample } from "./diagnosis-sample";
import { EscrowStates } from "./escrow-states";
import {
  LANDING_ANCHORS,
  LANDING_FEATURES,
  LANDING_GUARANTEES,
  LANDING_SAMPLE_DIAGNOSIS_RANGE_CENTS,
} from "./landing-data";
import { formatMxnFromCents } from "./landing-money";
import {
  anchorOffsetClass,
  containerClass,
  focusRingClass,
  LANDING_STAGGER_MS,
  sectionPaddingClass,
} from "./landing-styles";
import { Reveal } from "./reveal";
import { SectionIntro } from "./section-intro";
import { BentoGrid } from "~/components/ui/bento-grid";
import { cn } from "~/lib/utils";

/**
 * Destination of the "For businesses" anchor. The three pieces are not a
 * sequence, so they carry no numbers; they are a bento of unequal tiles, each
 * showing its claim instead of decorating it.
 */
export async function FeaturesSection() {
  const t = await getTranslations("landing.features");
  const tGuarantees = await getTranslations("landing.guaranteeTypes.types");
  const locale = await getLocale();

  const [aiDiagnosis, protectedPayments, realGuarantees] = LANDING_FEATURES;
  if (!aiDiagnosis || !protectedPayments || !realGuarantees) return null;

  const priceRange = `${formatMxnFromCents(locale, LANDING_SAMPLE_DIAGNOSIS_RANGE_CENTS.min)} – ${formatMxnFromCents(locale, LANDING_SAMPLE_DIAGNOSIS_RANGE_CENTS.max)}`;

  return (
    <section
      id={LANDING_ANCHORS.forBusiness}
      aria-labelledby="features-title"
      className={cn(anchorOffsetClass, "w-full border-t")}
    >
      <div className={cn(containerClass, sectionPaddingClass)}>
        <SectionIntro
          titleId="features-title"
          title={t("title")}
          subtitle={t("subtitle")}
        />

        <BentoGrid className="mt-14 auto-rows-auto grid-cols-1 gap-4 lg:grid-cols-3">
          <Reveal className="h-full lg:col-span-2" delayMs={LANDING_STAGGER_MS}>
            <BentoCard
              Icon={aiDiagnosis.icon}
              title={t("aiDiagnosis.title")}
              description={t("aiDiagnosis.description")}
            >
              <DiagnosisSample
                label={t("aiDiagnosis.sample.label")}
                rows={[
                  {
                    key: "fault",
                    term: t("aiDiagnosis.sample.fault"),
                    value: t("aiDiagnosis.sample.faultValue"),
                  },
                  {
                    key: "materials",
                    term: t("aiDiagnosis.sample.materials"),
                    value: t("aiDiagnosis.sample.materialsValue"),
                  },
                  {
                    key: "range",
                    term: t("aiDiagnosis.sample.range"),
                    value: priceRange,
                  },
                ]}
              />
            </BentoCard>
          </Reveal>

          <Reveal className="h-full" delayMs={2 * LANDING_STAGGER_MS}>
            <BentoCard
              Icon={protectedPayments.icon}
              title={t("protectedPayments.title")}
              description={t("protectedPayments.description")}
            >
              <EscrowStates
                states={(["held", "delivered", "released"] as const).map(
                  (key) => ({
                    key,
                    label: t(`protectedPayments.states.${key}`),
                  }),
                )}
              />
            </BentoCard>
          </Reveal>

          <Reveal className="lg:col-span-3" delayMs={3 * LANDING_STAGGER_MS}>
            <BentoCard
              Icon={realGuarantees.icon}
              title={t("realGuarantees.title")}
              description={t("realGuarantees.description")}
            >
              <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
                <ul className="flex flex-wrap gap-2">
                  {LANDING_GUARANTEES.map((guarantee) => (
                    <li
                      key={guarantee.key}
                      className="bg-background/60 text-foreground inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm"
                    >
                      <guarantee.icon
                        aria-hidden="true"
                        className="text-muted-foreground size-3.5"
                      />
                      {tGuarantees(`${guarantee.key}.title`)}
                    </li>
                  ))}
                </ul>
                <a
                  href={`#${LANDING_ANCHORS.guarantees}`}
                  className={cn(
                    "group/link text-foreground inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-md text-sm font-medium underline-offset-4 hover:underline",
                    focusRingClass,
                  )}
                >
                  {t("realGuarantees.link")}
                  <ArrowRightIcon
                    aria-hidden="true"
                    className="size-4 transition-transform duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] group-hover/link:translate-x-0.5 motion-reduce:transition-none"
                  />
                </a>
              </div>
            </BentoCard>
          </Reveal>
        </BentoGrid>
      </div>
    </section>
  );
}
