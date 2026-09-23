import type { ReactNode } from "react";
import { UserRole } from "@generated/prisma";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";

import { CorporateHeader } from "./_components/corporate-header";
import { CorporateSidebar } from "./_components/corporate-sidebar";
import { CorporateStatusBanner } from "./_components/corporate-status-banner";
import { SidebarInset, SidebarProvider } from "~/components/ui/sidebar";
import { routing } from "~/i18n/routing";
import { requireRole } from "~/server/auth/require-role";
import { db } from "~/server/db";

type CorporateLayoutProps = Readonly<{
  children: ReactNode;
  params: Promise<{ locale: string }>;
}>;

/**
 * Render barrier for the corporate panel (same F1-06 discipline as
 * /dashboard): no session goes to login with callback and locale, a foreign
 * role goes to its own home. The middleware is UX courtesy; data
 * authorization stays in the tRPC corporate procedures.
 */
export default async function CorporateLayout({
  children,
  params,
}: CorporateLayoutProps) {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  setRequestLocale(locale);
  const user = await requireRole(UserRole.CORPORATE, locale, "/corporate");
  const [account, t, common, cookieStore] = await Promise.all([
    db.corporateAccount.findUnique({
      where: { ownerId: user.id },
      select: { name: true, status: true, statusReason: true },
    }),
    getTranslations({ locale, namespace: "corporate" }),
    getTranslations({ locale, namespace: "common.userMenu" }),
    cookies(),
  ]);

  if (!account) {
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
    orders: t("nav.orders"),
    locations: t("nav.locations"),
    membership: t("nav.membership"),
  };

  return (
    <SidebarProvider defaultOpen={defaultOpen}>
      <a
        href="#corporate-content"
        className="bg-background text-foreground focus-visible:ring-ring fixed top-2 left-2 z-[60] -translate-y-16 rounded-md px-3 py-2 text-sm font-medium shadow-md focus-visible:translate-y-0 focus-visible:ring-2 focus-visible:outline-none"
      >
        {t("header.skipToContent")}
      </a>
      <CorporateSidebar
        labels={labels}
        brandLabel={t("sidebar.brandLabel")}
        mobileTitle={t("header.navigationTitle")}
        mobileDescription={t("header.navigationDescription")}
        user={{
          name: userName,
          subtitle: account.name,
          initials: initials || t("sidebar.placeholderInitials"),
        }}
      />
      <SidebarInset className="min-w-0">
        <CorporateHeader
          user={{ name: userName, email: userEmail, role: user.role }}
          toggleSidebarLabel={t("header.toggleSidebar")}
        />
        <main
          id="corporate-content"
          className="flex flex-col gap-4 p-4 sm:p-6 lg:p-8"
        >
          <CorporateStatusBanner
            status={account.status}
            statusReason={account.statusReason}
            locale={locale}
          />
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
