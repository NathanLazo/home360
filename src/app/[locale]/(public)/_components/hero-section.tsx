import { ShieldCheckIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { HeroVisual } from "./hero-visual";
import { LANDING_ANCHORS } from "./landing-data";
import {
  containerClass,
  displayTitleClass,
  eyebrowClass,
  focusRingOnNavy,
  leadClass,
  LANDING_DURATION,
} from "./landing-styles";
import { Reveal } from "./reveal";
import { Button } from "~/components/ui/button";
import { ShimmerButton } from "~/components/ui/shimmer-button";
import { TextAnimate } from "~/components/ui/text-animate";
import { Link } from "~/i18n/navigation";

/**
 * Navy opening band (§3). Choreography of §4: badge 0 ms → headline by word
 * 80 ms → subtitle 240 ms → CTAs 320 ms → visual 400 ms, under 900 ms total.
 */
export async function HeroSection() {
  const t = await getTranslations("landing.hero");

  return (
    <section className="w-full bg-[var(--brand-navy)] text-[var(--brand-cream)]">
      <div
        className={`${containerClass} grid grid-cols-1 items-center gap-12 py-24 lg:grid-cols-2 lg:gap-16 lg:py-32`}
      >
        <div className="flex flex-col items-start gap-6">
          <Reveal durationMs={LANDING_DURATION.standard}>
            <p
              className={`${eyebrowClass} inline-flex items-center gap-2 rounded-full border-2 border-[color-mix(in_srgb,var(--brand-gold)_70%,transparent)] px-3 py-1.5 text-[var(--brand-cream)]`}
            >
              <ShieldCheckIcon aria-hidden="true" className="size-4 shrink-0" />
              {t("badge")}
            </p>
          </Reveal>

          <TextAnimate
            as="h1"
            by="word"
            once
            startOnView
            animation="blurInUp"
            delay={0.08}
            duration={0.45}
            className={`${displayTitleClass} text-[var(--brand-cream)]`}
          >
            {t("title")}
          </TextAnimate>

          <Reveal delayMs={240} durationMs={LANDING_DURATION.slow}>
            <p className={`${leadClass} max-w-xl text-[var(--brand-gray)]`}>
              {t("subtitle")}
            </p>
          </Reveal>

          <Reveal delayMs={320} durationMs={LANDING_DURATION.slow}>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              {/* The single ShimmerButton of the whole product (§4). */}
              <ShimmerButton
                asChild
                background="var(--brand-gold)"
                shimmerColor="var(--brand-cream)"
                className={`h-12 px-6 text-base font-semibold text-[var(--brand-navy)] ${focusRingOnNavy}`}
              >
                <Link href="/register">{t("ctaPrimary")}</Link>
              </ShimmerButton>

              <Button
                asChild
                variant="outline"
                className={`h-12 rounded-md border-[color-mix(in_srgb,var(--brand-cream)_45%,transparent)] bg-transparent px-6 text-base font-medium text-[var(--brand-cream)] hover:border-[var(--brand-cream)] hover:bg-[color-mix(in_srgb,var(--brand-cream)_10%,transparent)] hover:text-[var(--brand-cream)] active:scale-[0.98] ${focusRingOnNavy}`}
              >
                <a href={`#${LANDING_ANCHORS.howItWorks}`}>
                  {t("ctaSecondary")}
                </a>
              </Button>
            </div>
          </Reveal>
        </div>

        <Reveal delayMs={400} durationMs={LANDING_DURATION.slow}>
          <HeroVisual />
        </Reveal>
      </div>
    </section>
  );
}
