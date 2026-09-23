import { hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";

import { toUsersFilters } from "./_components/users-query-filters";
import {
  businessDerivedStatusSchema,
  userAccessStatusSchema,
  usersTabSchema,
  workerAvailabilitySchema,
} from "./_components/users.schema";
import { UsersView } from "./_components/users-view";
import { routing } from "~/i18n/routing";
import { api, HydrateClient } from "~/trpc/server";

type UsersPageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function AdminUsersPage({
  params,
  searchParams,
}: UsersPageProps) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  setRequestLocale(locale);

  // Tab, search and filters live in the URL; the prefetch mirrors the client
  // query so the first render hydrates the exact list the admin asked for.
  const tab = usersTabSchema.safeParse(firstParam(query.tab));
  const status = businessDerivedStatusSchema.safeParse(
    firstParam(query.status),
  );
  const access = userAccessStatusSchema.safeParse(firstParam(query.access));
  const availability = workerAvailabilitySchema.safeParse(
    firstParam(query.availability),
  );

  await api.admin.users.list.prefetchInfinite(
    toUsersFilters({
      tab: tab.success ? tab.data : "businesses",
      search: firstParam(query.q)?.slice(0, 100) ?? "",
      status: status.success ? status.data : undefined,
      accessStatus: access.success ? access.data : undefined,
      availability: availability.success ? availability.data : undefined,
    }),
  );

  return (
    <HydrateClient>
      <UsersView />
    </HydrateClient>
  );
}
