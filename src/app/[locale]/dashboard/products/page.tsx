import { hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";

import { ProductsView } from "./_components/products-view";
import { routing } from "~/i18n/routing";
import { parseBranchParam } from "~/lib/search-params";
import { api, HydrateClient } from "~/trpc/server";

type ProductsPageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ProductsPage({
  params,
  searchParams,
}: ProductsPageProps) {
  const [{ locale }, resolvedSearchParams] = await Promise.all([
    params,
    searchParams,
  ]);
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const branchId = parseBranchParam(resolvedSearchParams);

  await Promise.all([
    api.product.list.prefetchInfinite(branchId ? { branchId } : {}),
    api.product.listCategories.prefetch(),
    api.product.listStockBranches.prefetch(),
  ]);

  return (
    <HydrateClient>
      <ProductsView branchId={branchId} />
    </HydrateClient>
  );
}
