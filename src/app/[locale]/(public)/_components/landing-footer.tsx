import { getTranslations } from "next-intl/server";

import { LANDING_ANCHORS, LANDING_NAV_KEYS } from "./landing-data";
import { LocaleSwitcher } from "~/components/locale-switcher";
import { Link } from "~/i18n/navigation";

const focusRing =
  "focus-visible:ring-[var(--brand-gold)] rounded-md focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--brand-navy)] focus-visible:outline-none";

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
    <footer className="bg-[var(--brand-navy)] text-[var(--brand-gray)]">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 py-12 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-10 md:flex-row md:justify-between">
          <div className="flex max-w-sm flex-col gap-3">
            <div className="flex items-center gap-2">
              <span
                aria-hidden="true"
                className="flex size-9 items-center justify-center rounded-lg bg-[var(--brand-gold)] text-lg font-semibold text-[var(--brand-navy)]"
              >
                {t("header.logoMark")}
              </span>
              <span className="text-lg font-semibold tracking-tight text-[var(--brand-cream)]">
                {t("header.brand")}
              </span>
            </div>
            <p className="text-sm text-[var(--brand-gray)]">
              {t("footer.tagline")}
            </p>
          </div>

          <nav
            aria-label={t("footer.navLabel")}
            className="grid grid-cols-1 gap-8 sm:grid-cols-2"
          >
            <div className="flex flex-col gap-3">
              <h2 className="text-sm font-semibold text-[var(--brand-cream)]">
                {t("footer.sections")}
              </h2>
              <ul className="flex flex-col gap-2">
                {sectionLinks.map((item) => (
                  <li key={item.key}>
                    <a
                      href={item.href}
                      className={`text-sm text-[var(--brand-gray)] underline-offset-4 hover:text-[var(--brand-cream)] hover:underline ${focusRing}`}
                    >
                      {item.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex flex-col gap-3">
              <h2 className="text-sm font-semibold text-[var(--brand-cream)]">
                {t("footer.account")}
              </h2>
              <ul className="flex flex-col gap-2">
                <li>
                  <Link
                    href="/login"
                    className={`text-sm text-[var(--brand-gray)] underline-offset-4 hover:text-[var(--brand-cream)] hover:underline ${focusRing}`}
                  >
                    {t("footer.links.login")}
                  </Link>
                </li>
                <li>
                  <Link
                    href="/register"
                    className={`text-sm text-[var(--brand-gray)] underline-offset-4 hover:text-[var(--brand-cream)] hover:underline ${focusRing}`}
                  >
                    {t("footer.links.register")}
                  </Link>
                </li>
              </ul>
            </div>
          </nav>
        </div>

        <div className="flex flex-col items-start gap-4 border-t border-[color-mix(in_srgb,var(--brand-gray)_30%,transparent)] pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-[var(--brand-gray)]">
            {t("footer.rights", { year })}
          </p>
          <LocaleSwitcher tone="dark" />
        </div>
      </div>
    </footer>
  );
}
