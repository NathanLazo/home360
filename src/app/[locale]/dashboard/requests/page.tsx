import { hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";

import { RequestsView } from "./_components/requests-view";
import { routing } from "~/i18n/routing";
import { parseBranchParam } from "~/lib/search-params";

type RequestsPageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function RequestsPage({
  params,
  searchParams,
}: RequestsPageProps) {
  const [{ locale }, resolvedSearchParams] = await Promise.all([
    params,
    searchParams,
  ]);
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  return <RequestsView branchId={parseBranchParam(resolvedSearchParams)} />;
}
