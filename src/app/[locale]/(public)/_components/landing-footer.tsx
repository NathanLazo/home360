import { getTranslations } from "next-intl/server";

import { LANDING_ANCHORS, LANDING_NAV_KEYS } from "./landing-data";
import { focusRingClass, inkSurfaceClass } from "./landing-styles";
import { LocaleSwitcher } from "~/components/locale-switcher";
import { Link } from "~/i18n/navigation";
import { cn } from "~/lib/utils";

const linkClass = cn(
  "text-copy-sm text-muted-foreground hover:text-foreground rounded-sm underline-offset-4 hover:underline",
  focusRingClass,
);

export async function LandingFooter() {
  const t = await getTranslations("landing");
  // Passed as a string so ICU does not apply number grouping ("2,026").
  const year = String(new Date().getFullYear());

  const sectionLinks = LANDING_NAV_KEYS.map((key) => ({
    key,
    href: `#${LANDING_ANCHORS[key]}`,
    label: t(`footer.links.${key}`),
  }));

  return (
    <footer className={cn(inkSurfaceClass, "border-t")}>
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 py-12 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-10 md:flex-row md:justify-between">
          <div className="flex max-w-sm flex-col gap-3">
            <div className="flex items-center gap-2">
              <span
                aria-hidden="true"
                className="bg-foreground text-background flex size-7 items-center justify-center rounded-sm text-sm font-semibold"
              >
                {t("header.logoMark")}
              </span>
              <span className="text-copy text-foreground font-semibold tracking-[-0.02em]">
                {t("header.brand")}
              </span>
            </div>
            <p className="text-copy-sm text-muted-foreground">
              {t("footer.tagline")}
            </p>
          </div>

          <nav
            aria-label={t("footer.navLabel")}
            className="grid grid-cols-1 gap-8 sm:grid-cols-2"
          >
            <div className="flex flex-col gap-3">
              <h2 className="text-copy-sm text-foreground font-medium">
                {t("footer.sections")}
              </h2>
              <ul className="flex flex-col gap-2">
                {sectionLinks.map((item) => (
                  <li key={item.key}>
                    <a href={item.href} className={linkClass}>
                      {item.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex flex-col gap-3">
              <h2 className="text-copy-sm text-foreground font-medium">
                {t("footer.account")}
              </h2>
              <ul className="flex flex-col gap-2">
                <li>
                  <Link href="/login" className={linkClass}>
                    {t("footer.links.login")}
                  </Link>
                </li>
                <li>
                  <Link href="/register" className={linkClass}>
                    {t("footer.links.register")}
                  </Link>
                </li>
              </ul>
            </div>
          </nav>
        </div>

        <div className="flex flex-col items-start gap-4 border-t pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-copy-sm text-muted-foreground">
            {t("footer.rights", { year })}
          </p>
          <LocaleSwitcher tone="dark" />
        </div>
      </div>
    </footer>
  );
}
