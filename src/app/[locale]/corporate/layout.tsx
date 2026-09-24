import type { ReactNode } from "react";
import { UserRole } from "@generated/prisma";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";

import {
  AppShellContent,
  AppShellFooter,
  AppShellInset,
} from "~/components/app-shell";
import { ImpersonationBanner } from "~/components/impersonation-banner";
import { LocaleSwitcher } from "~/components/locale-switcher";
import { ThemeToggle } from "~/components/theme-toggle";
import { SessionGuard } from "~/components/session-guard";
import { CorporateHeader } from "./_components/corporate-header";
import { CORPORATE_NAV } from "./_components/corporate-nav";
import { CorporateSidebar } from "./_components/corporate-sidebar";
import { CorporateStatusBanner } from "./_components/corporate-status-banner";
import { SidebarProvider } from "~/components/ui/sidebar";
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
      select: { name: true, status: true, statusReason: true, tier: true },
    }),
    getTranslations({ locale, namespace: "corporate" }),
    getTranslations({ locale, namespace: "common" }),
    cookies(),
  ]);

  if (!account) {
    notFound();
  }

  const sidebarState = cookieStore.get("sidebar_state")?.value;
  const defaultOpen = sidebarState === undefined || sidebarState === "true";
  const userName = user.name ?? t("sidebar.placeholderName");
  const userEmail = user.email ?? common("userMenu.emailUnavailable");
  const labels = {
    home: t("nav.home"),
    orders: t("nav.orders"),
    locations: t("nav.locations"),
    membership: t("nav.membership"),
    assistant: t("nav.assistant"),
    settings: t("nav.settings"),
  };
  const breadcrumb = {
    root: { label: account.name, href: "/corporate" },
    sections: CORPORATE_NAV.map((item) => ({
      key: item.key,
      href: item.href,
      label: labels[item.key],
    })),
  };

  return (
    <SidebarProvider defaultOpen={defaultOpen}>
      <a
        href="#corporate-content"
        className="bg-card text-foreground focus-visible:ring-ring shadow-float text-copy-sm fixed top-2 left-2 z-[60] -translate-y-16 rounded-sm px-3 py-2 font-medium focus-visible:translate-y-0 focus-visible:ring-2 focus-visible:outline-none"
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
          seed: user.id,
          image: user.image ?? null,
        }}
        tierChip={{
          label: t(`tier.${account.tier}`),
          ariaLabel: t("sidebar.tierLink", { tier: t(`tier.${account.tier}`) }),
        }}
      />
      <AppShellInset>
        <CorporateHeader
          user={{
            id: user.id,
            name: userName,
            email: userEmail,
            image: user.image ?? null,
            role: user.role,
          }}
          toggleSidebarLabel={t("header.toggleSidebar")}
          breadcrumb={breadcrumb}
        />
        <SessionGuard />
        <AppShellContent id="corporate-content">
          {user.impersonator ? (
            <ImpersonationBanner subjectName={account.name} />
          ) : null}
          <CorporateStatusBanner
            status={account.status}
            statusReason={account.statusReason}
            locale={locale}
          />
          {children}
        </AppShellContent>
        <AppShellFooter
          label={common("shell.footer")}
          end={
            <>
              <ThemeToggle />
              <LocaleSwitcher />
            </>
          }
        />
      </AppShellInset>
    </SidebarProvider>
  );
}
