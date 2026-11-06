import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";

import { LocaleSwitcher } from "~/components/locale-switcher";
import { Link } from "~/i18n/navigation";
import { cn } from "~/lib/utils";

export type LegalPage = "privacy" | "terms" | "support";

const LEGAL_PAGES: readonly LegalPage[] = ["privacy", "terms", "support"];

const linkClass =
  "text-copy-sm rounded-sm py-3 underline-offset-4 hover:underline focus-visible:ring-ring/50 focus-visible:ring-[3px] focus-visible:outline-none";

type LegalShellProps = {
  current: LegalPage;
  children: ReactNode;
};

/**
 * Chrome shared by the public legal pages (privacy, terms, support) that the
 * App Store listing and the mobile app link to: brand, cross-links and
 * locale switch around a readable single column. No landing effects.
 */
export async function LegalShell({ current, children }: LegalShellProps) {
  const t = await getTranslations("legal.nav");

  return (
    <div className="bg-canvas text-foreground flex min-h-dvh flex-col">
      <header className="border-b">
        <div className="mx-auto flex w-full max-w-2xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link
            href="/"
            className="text-copy rounded-sm py-3 font-semibold tracking-[-0.02em]"
          >
            {t("home")}
          </Link>
          <nav aria-label={t("label")}>
            <ul className="flex items-center gap-4">
              {LEGAL_PAGES.map((page) => (
                <li key={page}>
                  <Link
                    href={`/${page}`}
                    aria-current={page === current ? "page" : undefined}
                    className={cn(
                      linkClass,
                      page === current
                        ? "text-foreground font-medium"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {t(page)}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-12 sm:px-6 sm:py-16">
        {children}
      </main>
      <footer className="border-t">
        <div className="mx-auto flex w-full max-w-2xl justify-end px-4 py-6 sm:px-6">
          <LocaleSwitcher />
        </div>
      </footer>
    </div>
  );
}
