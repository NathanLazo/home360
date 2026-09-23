import { ArrowRightIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { LandingBeam } from "./landing-beam";
import {
  containerClass,
  displayHeadingClass,
  inkSurfaceClass,
  LANDING_BEAM_RADIUS,
  leadClass,
} from "./landing-styles";
import { Magnetic } from "./magnetic";
import { Reveal } from "./reveal";
import { SplitHeading } from "./split-heading";
import { Button } from "~/components/ui/button";
import { Link } from "~/i18n/navigation";
import { cn } from "~/lib/utils";

/**
 * Closing ink band. The register button is the static metal primary (inside
 * `.dark` it reads as light chrome on ink) wearing the page's last spectral
 * beam, bookending the beam around the hero console. It stays static: by now
 * the nav action is the live metal on screen. The app button is genuinely
 * disabled instead of pointing at a `#` that goes nowhere; the note under it
 * says so.
 */
export async function CtaSection() {
  const t = await getTranslations("landing.cta");

  return (
    <section
      aria-labelledby="cta-title"
      className={cn(inkSurfaceClass, "relative isolate w-full overflow-hidden")}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_60%_80%_at_50%_120%,color-mix(in_oklch,var(--foreground)_10%,transparent),transparent)]"
      />
      <div
        className={cn(
          containerClass,
          "flex flex-col items-center py-24 text-center lg:py-32",
        )}
      >
        <SplitHeading
          id="cta-title"
          text={t("title")}
          className={cn(displayHeadingClass, "max-w-3xl")}
        />
        <Reveal delayMs={200}>
          <p className={cn(leadClass, "mx-auto mt-5")}>{t("subtitle")}</p>
        </Reveal>

        <Reveal delayMs={320}>
          <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:items-start">
            <Magnetic>
              <LandingBeam
                size="pulse-outside"
                colorVariant="colorful"
                theme="dark"
                strength={0.8}
                borderRadius={LANDING_BEAM_RADIUS.pill}
                className="rounded-pill inline-flex"
              >
                <Button asChild size="pill">
                  <Link href="/register" className="group/cta">
                    {t("register")}
                    <ArrowRightIcon
                      aria-hidden="true"
                      className="transition-transform duration-150 ease-out group-hover/cta:translate-x-0.5 motion-reduce:transition-none"
                    />
                  </Link>
                </Button>
              </LandingBeam>
            </Magnetic>

            <div className="flex flex-col items-center gap-1.5">
              <Button
                type="button"
                variant="outline"
                size="pill"
                disabled
                aria-describedby="download-app-note"
              >
                {t("downloadApp")}
              </Button>
              <p
                id="download-app-note"
                className="text-label text-muted-foreground font-mono"
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
