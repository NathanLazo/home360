import type { ReactNode } from "react";
import { UserRole } from "../../../../generated/prisma";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";

import { adminNav } from "./_components/admin-nav";
import { AdminHeader } from "./_components/admin-header";
import { AdminSidebar } from "./_components/admin-sidebar";
import { SidebarInset, SidebarProvider } from "~/components/ui/sidebar";
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
    getTranslations({ locale, namespace: "common.userMenu" }),
    cookies(),
    getOpenDisputeCount(),
  ]);
  const sidebarState = cookieStore.get("sidebar_state")?.value;
  const defaultOpen = sidebarState === undefined || sidebarState === "true";
  const userName = user.name ?? t("sidebar.placeholderName");
  const userEmail = user.email ?? common("emailUnavailable");
  const labels = Object.fromEntries(
    adminNav.map((item) => [item.key, t(item.labelKey)]),
  );

  return (
    <SidebarProvider defaultOpen={defaultOpen}>
      <AdminSidebar
        labels={labels}
        openDisputes={openDisputes}
        brandLabel={t("sidebar.brandLabel")}
        mobileTitle={t("header.navigationTitle")}
        mobileDescription={t("header.navigationDescription")}
        user={{
          name: userName,
          initials: t("sidebar.placeholderInitials"),
        }}
      />
      <SidebarInset className="min-w-0">
        <AdminHeader
          user={{ name: userName, email: userEmail, role: user.role }}
          toggleSidebarLabel={t("header.toggleSidebar")}
        />
        <main className="p-4 sm:p-6 lg:p-8">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
