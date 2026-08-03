import type { ReactNode } from "react";
import { UserRole } from "../../../../generated/prisma";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";

import { DashboardHeader } from "./_components/dashboard-header";
import { DashboardMobileNav } from "~/components/dashboard-mobile-nav";
import { DashboardSidebar } from "~/components/dashboard-sidebar";
import { routing } from "~/i18n/routing";
import { requireRole } from "~/server/auth/require-role";
import { db } from "~/server/db";
import { getDashboardShellData } from "~/server/services/business/dashboard-shell";

type DashboardLayoutProps = Readonly<{
  children: ReactNode;
  params: Promise<{ locale: string }>;
}>;

export default async function DashboardLayout({
  children,
  params,
}: DashboardLayoutProps) {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  setRequestLocale(locale);
  const user = await requireRole(UserRole.BUSINESS, locale, "/dashboard");
  const [shell, t, common] = await Promise.all([
    getDashboardShellData(db, user.id),
    getTranslations({ locale, namespace: "dashboard" }),
    getTranslations({ locale, namespace: "common.userMenu" }),
  ]);

  if (!shell) {
    notFound();
  }

  const userName = user.name ?? t("sidebar.placeholderName");
  const userEmail = user.email ?? common("emailUnavailable");
  const initials = userName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
  const labels = {
    home: t("nav.home"),
    services: t("nav.services"),
    products: t("nav.products"),
    orders: t("nav.orders"),
    payments: t("nav.payments"),
    subscription: t("nav.subscription"),
    branches: t("nav.branches"),
  };

  return (
    <>
      <a
        href="#dashboard-content"
        className="bg-background text-foreground focus-visible:ring-ring fixed top-2 left-2 z-[60] -translate-y-16 rounded-md px-3 py-2 text-sm font-medium shadow-md transition-transform focus-visible:translate-y-0 focus-visible:ring-2 focus-visible:outline-none motion-reduce:transition-none"
      >
        {t("header.skipToContent")}
      </a>
      <div className="grid min-h-dvh lg:grid-cols-[16rem_minmax(0,1fr)]">
        <div className="sticky top-0 hidden h-dvh lg:block">
          <DashboardSidebar
            labels={labels}
            activeOrdersCount={shell.activeOrdersCount}
            user={{
              name: userName,
              subtitle: shell.business.name,
              initials: initials || t("sidebar.placeholderInitials"),
            }}
          />
        </div>
        <div className="min-w-0">
          <DashboardHeader
            user={{ name: userName, email: userEmail, role: user.role }}
            branches={shell.branches}
            mobileNavigation={
              <DashboardMobileNav
                labels={labels}
                activeOrdersCount={shell.activeOrdersCount}
                user={{
                  name: userName,
                  subtitle: shell.business.name,
                  initials: initials || t("sidebar.placeholderInitials"),
                }}
                openLabel={t("header.openNavigation")}
                closeLabel={t("header.closeNavigation")}
                title={t("header.navigationTitle")}
                description={t("header.navigationDescription")}
              />
            }
          />
          <main id="dashboard-content" className="p-4 sm:p-6 lg:p-8">
            {children}
          </main>
        </div>
      </div>
    </>
  );
}
