import { getLocale, getTranslations } from "next-intl/server";

import { LANDING_METRICS } from "./landing-data";
import { formatMxnFromCents } from "./landing-money";
import {
  containerClass,
  inkSurfaceClass,
  LANDING_STAGGER_MS,
  sectionPaddingClass,
} from "./landing-styles";
import { MetricItem } from "./metric-item";
import { Reveal } from "./reveal";
import { SectionIntro } from "./section-intro";
import { NumberTicker } from "~/components/ui/number-ticker";
import { cn } from "~/lib/utils";

type Metric = {
  key: string;
  /** The rendered figure: a ticker plus its unit, or a formatted amount. */
  figure: React.ReactNode;
  label: string;
};

/**
 * The first ink band: the heaviest moment between two light sections. The
 * fill is the light-scope ink and `.dark` scopes the tokens for its content.
 * Every figure is market data (D8), never our own traction, and the source
 * stays visible. Carries the landing's one section eyebrow (mono: it labels
 * data).
 */
export async function MetricsSection() {
  const t = await getTranslations("landing.metrics");
  const locale = await getLocale();

  function ticker(value: number, suffix: string, index: number) {
    return (
      <>
        <NumberTicker
          value={value}
          delay={0.2 + (index * LANDING_STAGGER_MS) / 1000}
          className="tracking-[-0.04em]"
        />
        {suffix}
      </>
    );
  }

  const metrics: Metric[] = [
    {
      key: "households",
      figure: ticker(
        LANDING_METRICS.households / 1_000_000,
        t("units.million"),
        0,
      ),
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
      className={cn(inkSurfaceClass, "w-full")}
    >
      <div className={cn(containerClass, sectionPaddingClass)}>
        <SectionIntro
          titleId="metrics-title"
          eyebrow={t("eyebrow")}
          title={t("title")}
          subtitle={t("subtitle")}
        />

        <ul className="bg-border mt-12 grid grid-cols-1 gap-px overflow-hidden rounded-lg border sm:grid-cols-2 lg:grid-cols-4">
          {metrics.map((metric, index) => (
            <li key={metric.key} className="bg-[var(--landing-ink)]">
              <Reveal
                className="h-full"
                delayMs={(index + 1) * LANDING_STAGGER_MS}
              >
                <MetricItem figure={metric.figure} label={metric.label} />
              </Reveal>
            </li>
          ))}
        </ul>

        <Reveal delayMs={5 * LANDING_STAGGER_MS}>
          <p className="text-label text-muted-foreground mt-6 font-mono">
            {t("source")}
          </p>
        </Reveal>
      </div>
    </section>
  );
}
