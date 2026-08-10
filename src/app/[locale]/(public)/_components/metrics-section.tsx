import { getLocale, getTranslations } from "next-intl/server";

import { LANDING_METRICS } from "./landing-data";
import { formatMxnFromCents } from "./landing-money";
import {
  containerClass,
  displayHeadingClass,
  eyebrowClass,
  figureClass,
  leadClass,
  LANDING_STAGGER_MS,
  sectionPaddingClass,
} from "./landing-styles";
import { Reveal } from "./reveal";
import { NumberTicker } from "~/components/ui/number-ticker";

type Metric = {
  key: string;
  /** The rendered figure: a ticker plus its unit, or a formatted amount. */
  figure: React.ReactNode;
  label: string;
};

/**
 * Navy band (§3): the heaviest moment, between two cream sections. Every
 * figure is market data (D8), never our own traction, and the source stays
 * visible — a number without a source is a claim, with one it is data.
 */
export async function MetricsSection() {
  const t = await getTranslations("landing.metrics");
  const locale = await getLocale();

  function ticker(value: number, suffix: string, index: number) {
    return (
      <>
        <NumberTicker
          value={value}
          delay={((index + 1) * LANDING_STAGGER_MS) / 1000}
        />
        {suffix}
      </>
    );
  }

  const metrics: Metric[] = [
    {
      key: "households",
      figure: ticker(LANDING_METRICS.households / 1_000_000, t("units.million"), 0),
      label: t("households"),
    },
    {
      key: "marketSize",
      figure: formatMxnFromCents(locale, LANDING_METRICS.marketSizeCents, {
        compact: true,
      }),
      label: t("marketSize"),
    },
    {
      key: "informality",
      figure: ticker(LANDING_METRICS.informalityPct, t("units.percent"), 2),
      label: t("informality"),
    },
    {
      key: "providers",
      figure: ticker(LANDING_METRICS.readyProviders, t("units.plus"), 3),
      label: t("providers"),
    },
  ];

  return (
    <section
      aria-labelledby="metrics-title"
      className="w-full bg-[var(--brand-navy)] text-[var(--brand-cream)]"
    >
      <div className={`${containerClass} ${sectionPaddingClass}`}>
        <Reveal>
          <div className="flex max-w-2xl flex-col gap-4">
            <h2
              id="metrics-title"
              className={`${displayHeadingClass} text-[var(--brand-cream)]`}
            >
              {t("title")}
            </h2>
            <p className={`${leadClass} text-[var(--brand-gray)]`}>
              {t("subtitle")}
            </p>
          </div>
        </Reveal>

        <ul className="mt-12 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
          {metrics.map((metric, index) => (
            <li key={metric.key}>
              <Reveal delayMs={(index + 1) * LANDING_STAGGER_MS}>
                <div className="flex flex-col gap-3 border-t border-[color-mix(in_srgb,var(--brand-gray)_40%,transparent)] pt-5">
                  <p className={`${figureClass} text-[var(--brand-gold)]`}>
                    {metric.figure}
                  </p>
                  <p className="text-[0.9375rem] leading-relaxed text-pretty text-[var(--brand-gray)]">
                    {metric.label}
                  </p>
                </div>
              </Reveal>
            </li>
          ))}
        </ul>

        <Reveal delayMs={5 * LANDING_STAGGER_MS}>
          <p
            className={`${eyebrowClass} mt-10 text-[color-mix(in_srgb,var(--brand-gray)_88%,transparent)]`}
          >
            {t("source")}
          </p>
        </Reveal>
      </div>
    </section>
  );
}
