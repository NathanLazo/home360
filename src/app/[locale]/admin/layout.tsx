import type { ReactNode } from "react";
import { UserRole } from "../../../../generated/prisma";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";

import { adminNav } from "./_components/admin-nav";
import { AdminHeader } from "./_components/admin-header";
import { AppSidebar, type SidebarItem } from "~/components/app-sidebar";
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
  const t = await getTranslations({ locale, namespace: "admin" });
  const common = await getTranslations({
    locale,
    namespace: "common.userMenu",
  });
  const openDisputes = await getOpenDisputeCount();
  const userName = user.name ?? t("sidebar.placeholderName");
  const userEmail = user.email ?? common("emailUnavailable");
  const items: SidebarItem[] = adminNav.map(({ labelKey, ...item }) => ({
    ...item,
    label: t(labelKey),
    badgeCount:
      item.key === "disputes" && openDisputes > 0 ? openDisputes : undefined,
  }));

  return (
    <div className="grid min-h-dvh lg:grid-cols-[16rem_minmax(0,1fr)]">
      {/* TODO(F6): expose this navigation through a Sheet below lg. */}
      <div className="sticky top-0 hidden h-dvh lg:block">
        <AppSidebar
          variant="dark"
          items={items}
          user={{
            name: userName,
            initials: t("sidebar.placeholderInitials"),
          }}
        />
      </div>
      <div className="min-w-0">
        <AdminHeader
          user={{ name: userName, email: userEmail, role: user.role }}
        />
        <main className="p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
