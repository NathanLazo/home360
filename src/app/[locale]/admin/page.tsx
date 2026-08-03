import { ShieldCheckIcon } from "lucide-react";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";

import { EmptyState } from "~/components/empty-state";
import { PageHeader } from "~/components/page-header";
import { routing } from "~/i18n/routing";

type AdminPageProps = {
  params: Promise<{ locale: string }>;
};

export default async function AdminPage({ params }: AdminPageProps) {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "admin.placeholder" });

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <EmptyState
        icon={ShieldCheckIcon}
        title={t("emptyTitle")}
        description={t("emptyDescription")}
      />
    </div>
  );
}
