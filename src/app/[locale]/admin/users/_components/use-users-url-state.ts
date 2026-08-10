"use client";

import { usePathname, useRouter } from "next/navigation";
import { useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";

import {
  businessDerivedStatusSchema,
  usersTabSchema,
  type BusinessDerivedStatus,
  type UsersTab,
} from "./users.schema";

export type UsersUrlState = {
  tab: UsersTab;
  status: BusinessDerivedStatus | undefined;
  businessId: string | null;
  setTab: (tab: UsersTab) => void;
  setStatus: (status: BusinessDerivedStatus | undefined) => void;
  openBusiness: (businessId: string) => void;
  closeBusiness: () => void;
};

/**
 * Tab, status filter and the detail sheet live in the URL so a refresh keeps
 * the screen and W9 can deep-link straight into a business.
 */
export function useUsersUrlState(): UsersUrlState {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const tab = useMemo(() => {
    const parsed = usersTabSchema.safeParse(searchParams.get("tab"));
    return parsed.success ? parsed.data : "businesses";
  }, [searchParams]);

  const status = useMemo(() => {
    const parsed = businessDerivedStatusSchema.safeParse(
      searchParams.get("status"),
    );
    return parsed.success ? parsed.data : undefined;
  }, [searchParams]);

  const businessId = searchParams.get("business");

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
    status,
    businessId,
    setTab: useCallback(
      (nextTab) =>
        replaceParams((params) => {
          params.set("tab", nextTab);
          // Status only applies to businesses; carrying it across tabs would
          // silently filter a list that has no such column.
          params.delete("status");
          params.delete("business");
        }),
      [replaceParams],
    ),
    setStatus: useCallback(
      (nextStatus) =>
        replaceParams((params) => {
          if (nextStatus === undefined) {
            params.delete("status");
            return;
          }
          params.set("status", nextStatus);
        }),
      [replaceParams],
    ),
    openBusiness: useCallback(
      (nextBusinessId) =>
        replaceParams((params) => params.set("business", nextBusinessId)),
      [replaceParams],
    ),
    closeBusiness: useCallback(
      () => replaceParams((params) => params.delete("business")),
      [replaceParams],
    ),
  };
}
