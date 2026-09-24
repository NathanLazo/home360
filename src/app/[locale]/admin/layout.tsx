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
import { LocaleSwitcher } from "~/components/locale-switcher";
import { ThemeToggle } from "~/components/theme-toggle";
import { SessionGuard } from "~/components/session-guard";
import { adminNav } from "./_components/admin-nav";
import { AdminHeader } from "./_components/admin-header";
import { AdminSidebar } from "./_components/admin-sidebar";
import { SidebarProvider } from "~/components/ui/sidebar";
import { routing } from "~/i18n/routing";
import { requireRole } from "~/server/auth/require-role";
import { api } from "~/trpc/server";

/**
 * The sidebar must stay navigable even when the counter query fails, so the
 * badge degrades to "no badge" instead of breaking the whole admin shell.
 */
async function getOpenDisputeCount(): Promise<number> {
  try {
    const response = await api.admin.overview.getSidebarStats();

    if (response.error !== null || response.result === null) {
      console.error(`[admin] getSidebarStats failed: ${response.error}`);
      return 0;
    }

    return response.result.openDisputes;
  } catch {
    console.error("[admin] getSidebarStats threw");
    return 0;
  }
}

type AdminLayoutProps = Readonly<{
  children: ReactNode;
  params: Promise<{ locale: string }>;
}>;

export default async function AdminLayout({
  children,
  params,
}: AdminLayoutProps) {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  setRequestLocale(locale);
  const user = await requireRole(UserRole.ADMIN, locale, "/admin");
  const [t, common, cookieStore, openDisputes] = await Promise.all([
    getTranslations({ locale, namespace: "admin" }),
    getTranslations({ locale, namespace: "common" }),
    cookies(),
    getOpenDisputeCount(),
  ]);
  const sidebarState = cookieStore.get("sidebar_state")?.value;
  const defaultOpen = sidebarState === undefined || sidebarState === "true";
  const userName = user.name ?? t("sidebar.placeholderName");
  const userEmail = user.email ?? common("userMenu.emailUnavailable");
  const labels = Object.fromEntries(
    adminNav.map((item) => [item.key, t(item.labelKey)]),
  );
  const breadcrumb = {
    root: { label: "HOME360", href: "/admin" },
    sections: adminNav.map((item) => ({
      key: item.key,
      href: item.href,
      label: t(item.labelKey),
    })),
  };

  return (
    <SidebarProvider defaultOpen={defaultOpen}>
      <a
        href="#admin-content"
        className="bg-card text-foreground focus-visible:ring-ring shadow-float text-copy-sm fixed top-2 left-2 z-[60] -translate-y-16 rounded-sm px-3 py-2 font-medium focus-visible:translate-y-0 focus-visible:ring-2 focus-visible:outline-none"
      >
        {t("header.skipToContent")}
      </a>
      <AdminSidebar
        labels={labels}
        openDisputes={openDisputes}
        brandLabel={t("sidebar.brandLabel")}
        mobileTitle={t("header.navigationTitle")}
        mobileDescription={t("header.navigationDescription")}
        user={{
          name: userName,
          seed: user.id,
          image: user.image ?? null,
        }}
      />
      <AppShellInset>
        <AdminHeader
          user={{
            id: user.id,
            name: userName,
            email: userEmail,
            image: user.image ?? null,
            role: user.role,
          }}
          toggleSidebarLabel={t("header.toggleSidebar")}
          roleLabel={t("header.roleBadge")}
          breadcrumb={breadcrumb}
        />
        <SessionGuard />
        <AppShellContent id="admin-content">{children}</AppShellContent>
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
