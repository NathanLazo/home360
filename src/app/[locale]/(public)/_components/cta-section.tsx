import { ArrowRightIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";

import {
  containerClass,
  displayTitleClass,
  focusRingClass,
  leadClass,
  pressClass,
} from "./landing-styles";
import { Magnetic } from "./magnetic";
import { Reveal } from "./reveal";
import { SplitHeading } from "./split-heading";
import { Link } from "~/i18n/navigation";
import { cn } from "~/lib/utils";

/**
 * Closing dark band. The app button is genuinely disabled instead of pointing
 * at a `#` that goes nowhere; the note next to it says so.
 */
export async function CtaSection() {
  const t = await getTranslations("landing.cta");

  return (
    <section
      aria-labelledby="cta-title"
      className="dark bg-background text-foreground relative isolate w-full overflow-hidden"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_60%_80%_at_50%_120%,color-mix(in_oklch,var(--foreground)_10%,transparent),transparent)]"
      />
      <div
        className={cn(
          containerClass,
          "flex flex-col items-center py-28 text-center lg:py-40",
        )}
      >
        <SplitHeading
          id="cta-title"
          text={t("title")}
          className={cn(displayTitleClass, "max-w-4xl")}
        />
        <Reveal delayMs={200}>
          <p className={cn(leadClass, "mx-auto mt-6")}>{t("subtitle")}</p>
        </Reveal>

        <Reveal delayMs={320}>
          <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:items-start">
            <Magnetic>
              <Link
                href="/register"
                className={cn(
                  "group/cta bg-primary text-primary-foreground hover:bg-primary/90 inline-flex h-12 items-center gap-2 rounded-full px-6 text-base font-medium",
                  pressClass,
                  focusRingClass,
                )}
              >
                {t("register")}
                <ArrowRightIcon
                  aria-hidden="true"
                  className="size-4 transition-transform duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] group-hover/cta:translate-x-0.5 motion-reduce:transition-none"
                />
              </Link>
            </Magnetic>

            <div className="flex flex-col items-center gap-1.5">
              <button
                type="button"
                disabled
                aria-describedby="download-app-note"
                className="text-muted-foreground inline-flex h-12 cursor-not-allowed items-center rounded-full border px-6 text-base font-medium"
              >
                {t("downloadApp")}
              </button>
              <p
                id="download-app-note"
                className="text-muted-foreground font-mono text-xs"
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
