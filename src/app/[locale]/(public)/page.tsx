import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";

import { LocaleSwitcher } from "~/components/locale-switcher";
import { routing } from "~/i18n/routing";

type PublicPageProps = {
  params: Promise<{ locale: string }>;
};

export default async function PublicPage({ params }: PublicPageProps) {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  setRequestLocale(locale);
  const t = await getTranslations("landing");

  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-12 sm:px-6">
      <section
        aria-labelledby="placeholder-title"
        className="flex w-full max-w-2xl flex-col items-center gap-8 text-center"
      >
        <h1
          id="placeholder-title"
          className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl"
        >
          {t("placeholderTitle")}
        </h1>
        <LocaleSwitcher />
      </section>
    </main>
  );
}
