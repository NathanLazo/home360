import type { Metadata } from "next";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";

import { SupportContact } from "./_components/support-contact";
import { LegalHeader } from "~/components/legal/legal-header";
import { LegalSections } from "~/components/legal/legal-sections";
import { LegalShell } from "~/components/legal/legal-shell";
import { routing } from "~/i18n/routing";

const SECTION_KEYS = [
  "payment",
  "dispute",
  "cancel",
  "business",
  "delete",
] as const;

type SupportPageProps = { params: Promise<{ locale: string }> };

export async function generateMetadata({
  params,
}: SupportPageProps): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const t = await getTranslations({ locale, namespace: "legal.support" });

  return { title: t("metaTitle"), description: t("metaDescription") };
}

/** Support page (App Store "Support URL"): contact email plus FAQ. */
export default async function SupportPage({ params }: SupportPageProps) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "legal.support" });
  const tLegal = await getTranslations({ locale, namespace: "legal" });

  return (
    <LegalShell current="support">
      <LegalHeader
        title={t("title")}
        updated={tLegal("updated")}
        intro={t("intro")}
      />
      <SupportContact />
      <h2 className="text-display-sm text-foreground mt-14 mb-8">
        {t("faqTitle")}
      </h2>
      <LegalSections
        headingLevel="h3"
        sections={SECTION_KEYS.map((key) => ({
          key,
          title: t(`sections.${key}.title`),
          body: t(`sections.${key}.body`),
        }))}
      />
    </LegalShell>
  );
}
