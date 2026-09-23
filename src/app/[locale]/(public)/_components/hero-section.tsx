import { getTranslations } from "next-intl/server";

import { HeroBackdrop } from "./hero-backdrop";
import { HeroSubtitle } from "./hero-subtitle";
import { HeroVisual } from "./hero-visual";
import { HeroVisualStage } from "./hero-visual-stage";
import { LANDING_ANCHORS } from "./landing-data";
import {
  containerClass,
  displayTitleClass,
  focusRingClass,
  pressClass,
} from "./landing-styles";
import { MetalCta } from "./metal-cta";
import { MetalNewBadge } from "./metal-new-badge";
import { Reveal } from "./reveal";
import { SplitHeading } from "./split-heading";
import { cn } from "~/lib/utils";

/**
 * Opening band. One authored sequence, not scattered effects: announcement
 * (0 ms) → headline rising word by word out of its masks (80 ms) → subtitle
 * blurring in (420 ms) → CTAs (560 ms) → the custody console, which then
 * comes forward with the scroll.
 */
export async function HeroSection() {
  const t = await getTranslations("landing.hero");

  return (
    <section className="relative isolate overflow-hidden">
      <HeroBackdrop />

      <div
        className={cn(
          containerClass,
          "flex flex-col items-center pt-20 text-center sm:pt-24 lg:pt-32",
        )}
      >
        <Reveal durationMs={500}>
          <p className="bg-card/80 text-muted-foreground inline-flex items-center gap-3 rounded-full border py-1 pr-4 pl-1 text-sm shadow-[0_1px_2px_rgb(0_0_0/0.04)] backdrop-blur-sm">
            <MetalNewBadge label={t("badgeNew")} />
            {t("badge")}
          </p>
        </Reveal>

        <SplitHeading
          as="h1"
          text={t("title")}
          delayMs={80}
          className={cn(displayTitleClass, "mt-8 max-w-[17ch] sm:max-w-5xl")}
        />

        <HeroSubtitle text={t("subtitle")} className="mx-auto mt-7" />

        <Reveal delayMs={560} durationMs={500}>
          <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row">
            <MetalCta href="/register" label={t("ctaPrimary")} />
            <a
              href={`#${LANDING_ANCHORS.howItWorks}`}
              className={cn(
                "text-foreground hover:bg-foreground/5 inline-flex h-12 items-center rounded-full px-6 text-base font-medium",
                pressClass,
                focusRingClass,
              )}
            >
              {t("ctaSecondary")}
            </a>
          </div>
        </Reveal>
      </div>

      <div className={cn(containerClass, "mt-16 pb-24 sm:mt-20 lg:pb-32")}>
        <Reveal delayMs={700} durationMs={700}>
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
