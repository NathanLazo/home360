import { hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";

import {
  ADMIN_ORDER_SEARCH_MAX,
  adminOrderStatusSchema,
  adminOrderTypeSchema,
  toAdminOrderListInput,
} from "./_components/admin-orders.schema";
import { AdminOrdersView } from "./_components/admin-orders-view";
import { routing } from "~/i18n/routing";
import { api, HydrateClient } from "~/trpc/server";

type AdminOrdersPageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function AdminOrdersPage({
  params,
  searchParams,
}: AdminOrdersPageProps) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  // Filters live in the URL; the prefetch mirrors them so the first client
  // render hydrates the exact page requested.
  const status = adminOrderStatusSchema.safeParse(firstParam(query.status));
  const type = adminOrderTypeSchema.safeParse(firstParam(query.type));
  await api.admin.orders.list.prefetchInfinite(
    toAdminOrderListInput({
      status: status.success ? status.data : undefined,
      type: type.success ? type.data : undefined,
      search: firstParam(query.q)?.slice(0, ADMIN_ORDER_SEARCH_MAX) ?? "",
    }),
  );

  return (
    <HydrateClient>
      <AdminOrdersView />
    </HydrateClient>
  );
}
