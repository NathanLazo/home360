import { getTranslations } from "next-intl/server";

import { HeroBackdrop } from "./hero-backdrop";
import { HeroSubtitle } from "./hero-subtitle";
import { HeroVisual } from "./hero-visual";
import { HeroVisualStage } from "./hero-visual-stage";
import { LANDING_ANCHORS } from "./landing-data";
import { containerClass, heroTitleClass } from "./landing-styles";
import { MetalCta } from "./metal-cta";
import { MetalNewBadge } from "./metal-new-badge";
import { Reveal } from "./reveal";
import { SplitHeading } from "./split-heading";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";

/**
 * Opening band over the brand mesh. One authored sequence, not scattered
 * effects: announcement (0 ms) → headline rising word by word out of its
 * masks (80 ms) → subtitle blurring in (420 ms) → CTAs (560 ms) → the custody
 * console, which then comes forward with the scroll.
 *
 * The top padding clears the floating glass nav (12 px inset + 64 px dock).
 */
export async function HeroSection() {
  const t = await getTranslations("landing.hero");

  return (
    <section className="relative isolate overflow-hidden">
      <HeroBackdrop />

      <div
        className={cn(
          containerClass,
          "flex flex-col items-center pt-32 text-center sm:pt-36 lg:pt-44",
        )}
      >
        <Reveal durationMs={500}>
          <div className="bg-canvas/80 text-copy-sm text-muted-foreground rounded-pill shadow-subtle inline-flex items-center gap-3 py-1 pr-4 pl-1">
            <MetalNewBadge label={t("badgeNew")} />
            {t("badge")}
          </div>
        </Reveal>

        <SplitHeading
          as="h1"
          text={t("title")}
          delayMs={80}
          className={cn(heroTitleClass, "mt-8 max-w-[17ch] sm:max-w-4xl")}
        />

        <HeroSubtitle text={t("subtitle")} className="mx-auto mt-6" />

        <Reveal delayMs={560} durationMs={500}>
          <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row">
            <MetalCta href="/register" label={t("ctaPrimary")} />
            <Button asChild variant="secondary" size="pill">
              <a href={`#${LANDING_ANCHORS.howItWorks}`}>{t("ctaSecondary")}</a>
            </Button>
          </div>
        </Reveal>
      </div>

      <div className={cn(containerClass, "mt-16 pb-20 sm:mt-20 lg:pb-28")}>
        <Reveal delayMs={700} durationMs={600}>
          <HeroVisualStage>
            <div className="mx-auto max-w-5xl">
              <HeroVisual />
            </div>
          </HeroVisualStage>
        </Reveal>
      </div>
    </section>
  );
}
