import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";

import { routing } from "~/i18n/routing";

type PayCancelledPageProps = {
  params: Promise<{ locale: string }>;
};

export default async function PayCancelledPage({
  params,
}: PayCancelledPageProps) {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  setRequestLocale(locale);

  const t = await getTranslations("common.pay.cancelled");

  return (
    <main className="bg-canvas-soft flex min-h-dvh items-center justify-center p-6">
      <div className="flex max-w-md flex-col items-center gap-3 text-center">
        <h1 className="text-display-md text-balance">{t("title")}</h1>
        <p className="text-muted-foreground text-copy text-pretty">
          {t("description")}
        </p>
      </div>
    </main>
  );
}
