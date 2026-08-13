"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";

import {
  corporateTabSchema,
  corporateTierSchema,
  type CorporateTab,
  type CorporateTierValue,
} from "./corporate.schema";

export type CorporateUrlState = {
  tab: CorporateTab;
  tier: CorporateTierValue | undefined;
  search: string;
  accountId: string | null;
  setTab: (tab: CorporateTab) => void;
  setTier: (tier: CorporateTierValue | undefined) => void;
  setSearch: (search: string) => void;
  openAccount: (accountId: string) => void;
  closeAccount: () => void;
};

/**
 * Tab, tier, search and the detail sheet live in the URL so a refresh keeps
 * the screen and other admin surfaces can deep-link into an account.
 */
export function useCorporateUrlState(): CorporateUrlState {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const tab = useMemo(() => {
    const parsed = corporateTabSchema.safeParse(searchParams.get("tab"));
    return parsed.success ? parsed.data : "all";
  }, [searchParams]);

  const tier = useMemo(() => {
    const parsed = corporateTierSchema.safeParse(searchParams.get("tier"));
    return parsed.success ? parsed.data : undefined;
  }, [searchParams]);

  const search = searchParams.get("q") ?? "";
  const accountId = searchParams.get("account");

  const replaceParams = useCallback(
    (mutate: (params: URLSearchParams) => void) => {
      const params = new URLSearchParams(searchParams.toString());
      mutate(params);
      const query = params.toString();
      router.replace(query.length > 0 ? `${pathname}?${query}` : pathname, {
        scroll: false,
      });
    },
    [pathname, router, searchParams],
  );

  return {
    tab,
    tier,
    search,
    accountId,
    setTab: useCallback(
      (nextTab) =>
        replaceParams((params) => {
          if (nextTab === "all") {
            params.delete("tab");
          } else {
            params.set("tab", nextTab);
          }
        }),
      [replaceParams],
    ),
    setTier: useCallback(
      (nextTier) =>
        replaceParams((params) => {
          if (nextTier === undefined) {
            params.delete("tier");
          } else {
            params.set("tier", nextTier);
          }
        }),
      [replaceParams],
    ),
    setSearch: useCallback(
      (nextSearch) =>
        replaceParams((params) => {
          if (nextSearch.length === 0) {
            params.delete("q");
          } else {
            params.set("q", nextSearch);
          }
        }),
      [replaceParams],
    ),
    openAccount: useCallback(
      (nextAccountId) =>
        replaceParams((params) => params.set("account", nextAccountId)),
      [replaceParams],
    ),
    closeAccount: useCallback(
      () => replaceParams((params) => params.delete("account")),
      [replaceParams],
    ),
  };
}
