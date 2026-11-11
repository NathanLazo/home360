import type { Metadata } from "next";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";

import { LegalHeader } from "~/components/legal/legal-header";
import { LegalSections } from "~/components/legal/legal-sections";
import { LegalShell } from "~/components/legal/legal-shell";
import { routing } from "~/i18n/routing";

const SECTION_KEYS = [
  "service",
  "accounts",
  "escrow",
  "evidence",
  "cancellations",
  "conduct",
  "liability",
  "law",
  "contact",
] as const;

type TermsPageProps = { params: Promise<{ locale: string }> };

export async function generateMetadata({
  params,
}: TermsPageProps): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const t = await getTranslations({ locale, namespace: "legal.terms" });

  return { title: t("metaTitle"), description: t("metaDescription") };
}

/** Terms of service, linked from the mobile auth screens. */
export default async function TermsPage({ params }: TermsPageProps) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "legal.terms" });
  const tLegal = await getTranslations({ locale, namespace: "legal" });

  return (
    <LegalShell current="terms">
      <LegalHeader
        title={t("title")}
        updated={tLegal("updated")}
        intro={t("intro")}
      />
      <LegalSections
        sections={SECTION_KEYS.map((key) => ({
          key,
          title: t(`sections.${key}.title`),
          body: t(`sections.${key}.body`),
        }))}
      />
    </LegalShell>
  );
}
