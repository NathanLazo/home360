import type { Metadata } from "next";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";

import { LegalHeader } from "~/components/legal/legal-header";
import { LegalSections } from "~/components/legal/legal-sections";
import { LegalShell } from "~/components/legal/legal-shell";
import { routing } from "~/i18n/routing";

const SECTION_KEYS = [
  "controller",
  "data",
  "purposes",
  "ai",
  "sharing",
  "retention",
  "rights",
  "security",
  "minors",
  "changes",
] as const;

type PrivacyPageProps = { params: Promise<{ locale: string }> };

export async function generateMetadata({
  params,
}: PrivacyPageProps): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const t = await getTranslations({ locale, namespace: "legal.privacy" });

  return { title: t("metaTitle"), description: t("metaDescription") };
}

/** Privacy policy (App Store "Privacy Policy URL"; linked from the mobile app). */
export default async function PrivacyPage({ params }: PrivacyPageProps) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "legal.privacy" });
  const tLegal = await getTranslations({ locale, namespace: "legal" });

  return (
    <LegalShell current="privacy">
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
