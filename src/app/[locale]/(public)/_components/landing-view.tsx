import { getTranslations } from "next-intl/server";

import { CtaSection } from "./cta-section";
import { FeaturesSection } from "./features-section";
import { GuaranteesSection } from "./guarantees-section";
import { HeroSection } from "./hero-section";
import { HowItWorksSection } from "./how-it-works-section";
import { LandingFooter } from "./landing-footer";
import { LandingHeader } from "./landing-header";
import { LandingMotionProvider } from "./landing-motion-provider";
import { focusRingClass } from "./landing-styles";
import { MetricsSection } from "./metrics-section";
import { PricingSection } from "./pricing-section";
import { cn } from "~/lib/utils";

/**
 * Landing shell. Monochrome zinc, the same tokens as the dashboard: light
 * bands on `--background`/`--card`, dark bands as `.dark` scopes. Section
 * order follows the visitor's questions — what is it, what does it do, how,
 * how big, what backs it, what does it cost — and ends on the one action.
 */
export async function LandingView() {
  const t = await getTranslations("landing.header");

  return (
    <LandingMotionProvider>
      <div
        data-landing="true"
        className="bg-background text-foreground selection:bg-foreground selection:text-background flex min-h-dvh flex-col"
      >
        <a
          href="#main"
          className={cn(
            "focus-visible:bg-foreground focus-visible:text-background sr-only focus-visible:not-sr-only focus-visible:absolute focus-visible:top-3 focus-visible:left-3 focus-visible:z-[60] focus-visible:rounded-md focus-visible:px-4 focus-visible:py-3",
            focusRingClass,
          )}
        >
          {t("skipToContent")}
        </a>
        <LandingHeader />
        <main id="main" className="flex-1 scroll-mt-24">
          <HeroSection />
          <FeaturesSection />
          <HowItWorksSection />
          <MetricsSection />
          <GuaranteesSection />
          <PricingSection />
          <CtaSection />
        </main>
        <LandingFooter />
      </div>
    </LandingMotionProvider>
  );
}
