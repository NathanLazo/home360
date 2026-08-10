import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";

import { routing } from "~/i18n/routing";

type PaySuccessPageProps = {
  params: Promise<{ locale: string }>;
};

export default async function PaySuccessPage({ params }: PaySuccessPageProps) {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  setRequestLocale(locale);

  const t = await getTranslations("common.pay.success");

  return (
    <main className="flex min-h-dvh items-center justify-center p-6">
      <div className="flex max-w-md flex-col items-center gap-3 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground">{t("description")}</p>
      </div>
    </main>
  );
}
