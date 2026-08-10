import { getTranslations } from "next-intl/server";

import {
  containerClass,
  displayHeadingClass,
  eyebrowClass,
  focusRingOnNavy,
  leadClass,
  sectionPaddingClass,
} from "./landing-styles";
import { Reveal } from "./reveal";
import { Button } from "~/components/ui/button";
import { Link } from "~/i18n/navigation";

/**
 * Closing navy band (§3), no gradients. The app button is genuinely disabled
 * instead of pointing at a `#` that goes nowhere; the note next to it says so.
 */
export async function CtaSection() {
  const t = await getTranslations("landing.cta");

  return (
    <section
      aria-labelledby="cta-title"
      className="w-full bg-[var(--brand-navy)] text-[var(--brand-cream)]"
    >
      <div
        className={`${containerClass} ${sectionPaddingClass} flex flex-col items-start gap-6`}
      >
        <Reveal>
          <div className="flex max-w-2xl flex-col gap-4">
            <h2
              id="cta-title"
              className={`${displayHeadingClass} text-[var(--brand-cream)]`}
            >
              {t("title")}
            </h2>
            <p className={`${leadClass} text-[var(--brand-gray)]`}>
              {t("subtitle")}
            </p>
          </div>
        </Reveal>

        <Reveal delayMs={80}>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <Button
              asChild
              className={`h-12 rounded-md bg-[var(--brand-gold)] px-6 text-base font-semibold text-[var(--brand-navy)] hover:bg-[color-mix(in_srgb,var(--brand-gold)_88%,white)] active:scale-[0.98] ${focusRingOnNavy}`}
            >
              <Link href="/register">{t("register")}</Link>
            </Button>

            <div className="flex flex-col gap-1">
              <Button
                type="button"
                disabled
                aria-describedby="download-app-note"
                className="h-12 rounded-md border border-[color-mix(in_srgb,var(--brand-cream)_35%,transparent)] bg-transparent px-6 text-base font-medium text-[var(--brand-cream)] shadow-none"
              >
                {t("downloadApp")}
              </Button>
              <p
                id="download-app-note"
                className={`${eyebrowClass} text-[var(--brand-gray)]`}
              >
                {t("downloadAppSoon")}
              </p>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
