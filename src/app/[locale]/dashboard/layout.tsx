import type { ReactNode } from "react";
import { UserRole } from "@generated/prisma";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";

import { DashboardHeader } from "./_components/dashboard-header";
import { SubscriptionStatusBanner } from "./_components/subscription-status-banner";
import { SubscriptionAccessProvider } from "~/components/dashboard/subscription-access-context";
import { DashboardSidebar } from "~/components/dashboard-sidebar";
import { SidebarInset, SidebarProvider } from "~/components/ui/sidebar";
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
  const [shell, t, common, cookieStore] = await Promise.all([
    getDashboardShellData(db, user.id),
    getTranslations({ locale, namespace: "dashboard" }),
    getTranslations({ locale, namespace: "common.userMenu" }),
    cookies(),
  ]);

  if (!shell) {
    notFound();
  }

  const sidebarState = cookieStore.get("sidebar_state")?.value;
  const defaultOpen = sidebarState === undefined || sidebarState === "true";
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
    team: t("nav.team"),
    settings: t("nav.settings"),
  };

  return (
    <SidebarProvider defaultOpen={defaultOpen}>
      <a
        href="#dashboard-content"
        className="bg-background text-foreground focus-visible:ring-ring fixed top-2 left-2 z-[60] -translate-y-16 rounded-md px-3 py-2 text-sm font-medium shadow-md transition-transform focus-visible:translate-y-0 focus-visible:ring-2 focus-visible:outline-none motion-reduce:transition-none"
      >
        {t("header.skipToContent")}
      </a>
      <DashboardSidebar
        labels={labels}
        activeOrdersCount={shell.activeOrdersCount}
        brandLabel={t("sidebar.brandLabel")}
        mobileTitle={t("header.navigationTitle")}
        mobileDescription={t("header.navigationDescription")}
        user={{
          name: userName,
          subtitle: shell.business.name,
          initials: initials || t("sidebar.placeholderInitials"),
        }}
      />
      <SidebarInset className="min-w-0">
        <DashboardHeader
          user={{ name: userName, email: userEmail, role: user.role }}
          branches={shell.branches}
          toggleSidebarLabel={t("header.toggleSidebar")}
        />
        <main
          id="dashboard-content"
          className="flex flex-col gap-4 p-4 sm:p-6 lg:p-8"
        >
          <SubscriptionAccessProvider
            initialStatus={shell.subscription?.status ?? null}
          >
            <SubscriptionStatusBanner
              status={shell.subscription?.status ?? null}
              renewsAt={shell.subscription?.renewsAt ?? null}
            />
            {children}
          </SubscriptionAccessProvider>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
