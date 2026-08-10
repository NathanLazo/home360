import { getTranslations } from "next-intl/server";

import { CtaSection } from "./cta-section";
import { FeaturesSection } from "./features-section";
import { HeroSection } from "./hero-section";
import { HowItWorksSection } from "./how-it-works-section";
import { LandingFooter } from "./landing-footer";
import { LandingHeader } from "./landing-header";
import { LandingMotionProvider } from "./landing-motion-provider";
import { MetricsSection } from "./metrics-section";
import { PricingSection } from "./pricing-section";
import { focusRingOnCream } from "./landing-styles";

/**
 * Landing shell. Section order is normative (`spec/06-landing-polish.md` §1)
 * and follows the cream → navy → cream rhythm of DESIGN-DIRECTIVE §3.
 */
export async function LandingView() {
  const t = await getTranslations("landing.header");

  return (
    <LandingMotionProvider>
      <div
        data-landing="true"
        className="flex min-h-dvh flex-col bg-[var(--brand-cream)] text-[var(--brand-navy)]"
      >
        <a
          href="#main"
          className={`sr-only focus-visible:not-sr-only focus-visible:absolute focus-visible:top-3 focus-visible:left-3 focus-visible:z-[60] focus-visible:rounded-md focus-visible:bg-[var(--brand-navy)] focus-visible:px-4 focus-visible:py-3 focus-visible:text-[var(--brand-cream)] ${focusRingOnCream}`}
        >
          {t("skipToContent")}
        </a>
        <LandingHeader />
        <main id="main" className="flex-1 scroll-mt-24">
          <HeroSection />
          <FeaturesSection />
          <HowItWorksSection />
          <MetricsSection />
          <PricingSection />
          <CtaSection />
        </main>
        <LandingFooter />
      </div>
    </LandingMotionProvider>
  );
}
