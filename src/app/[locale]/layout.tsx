import "~/styles/globals.css";

import { type Metadata } from "next";
import { Fraunces, Geist, Geist_Mono } from "next/font/google";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";

import { Toaster } from "~/components/ui/sonner";
import { routing } from "~/i18n/routing";
import { TRPCReactProvider } from "~/trpc/react";

/**
 * Geist carries the product (DESIGN.md §3): sans for everything, mono for
 * technical labels, eyebrows and verifiable figures.
 */
const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
});

/**
 * Editorial accent for the public landing only (owner's pick): the `*accent*`
 * words inside display headings. Exposed as `--font-display`; product
 * surfaces never use it.
 */
const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  display: "swap",
  axes: ["SOFT", "opsz"],
});

type LocaleLayoutProps = Readonly<{
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}>;

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: Pick<LocaleLayoutProps, "params">): Promise<Metadata> {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  const t = await getTranslations({ locale, namespace: "common" });

  return {
    title: t("appName"),
    icons: [{ rel: "icon", url: "/favicon.ico" }],
  };
}

export default async function LocaleLayout({
  children,
  params,
}: LocaleLayoutProps) {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  setRequestLocale(locale);

  return (
    <html
      lang={locale}
      className={`${geist.variable} ${geistMono.variable} ${fraunces.variable}`}
    >
      <body className="antialiased">
        <NextIntlClientProvider>
          <TRPCReactProvider>
            {children}
            <Toaster />
          </TRPCReactProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
