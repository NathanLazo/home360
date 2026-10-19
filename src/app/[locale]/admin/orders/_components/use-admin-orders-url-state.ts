"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";

import {
  ADMIN_ORDER_SEARCH_MAX,
  adminOrderStatusSchema,
  adminOrderTypeSchema,
  type AdminOrderStatusValue,
  type AdminOrderTypeValue,
} from "./admin-orders.schema";

export type AdminOrdersUrlState = {
  status: AdminOrderStatusValue | undefined;
  type: AdminOrderTypeValue | undefined;
  search: string;
  orderId: string | null;
  setStatus: (status: AdminOrderStatusValue | undefined) => void;
  setType: (type: AdminOrderTypeValue | undefined) => void;
  setSearch: (search: string) => void;
  clearFilters: () => void;
  /** Status and type only (the drawer's "clear"); the search stays. */
  clearSelectFilters: () => void;
  openOrder: (orderId: string) => void;
  closeOrder: () => void;
};

/**
 * Filters and the open order live in the URL (`?status=&type=&q=&order=`)
 * so a refresh keeps the view and other admin screens can deep-link into an
 * order file.
 */
export function useAdminOrdersUrlState(): AdminOrdersUrlState {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const status = useMemo(() => {
    const parsed = adminOrderStatusSchema.safeParse(searchParams.get("status"));
    return parsed.success ? parsed.data : undefined;
  }, [searchParams]);

  const type = useMemo(() => {
    const parsed = adminOrderTypeSchema.safeParse(searchParams.get("type"));
    return parsed.success ? parsed.data : undefined;
  }, [searchParams]);

  const search = (searchParams.get("q") ?? "").slice(0, ADMIN_ORDER_SEARCH_MAX);
  const orderId = searchParams.get("order");

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

  const setParam = useCallback(
    (key: string, value: string | undefined) =>
      replaceParams((params) => {
        if (value === undefined || value.length === 0) params.delete(key);
        else params.set(key, value);
      }),
    [replaceParams],
  );

  return {
    status,
    type,
    search,
    orderId,
    setStatus: useCallback((next) => setParam("status", next), [setParam]),
    setType: useCallback((next) => setParam("type", next), [setParam]),
    setSearch: useCallback((next) => setParam("q", next), [setParam]),
    clearFilters: useCallback(
      () =>
        replaceParams((params) => {
          params.delete("status");
          params.delete("type");
          params.delete("q");
        }),
      [replaceParams],
    ),
    clearSelectFilters: useCallback(
      () =>
        replaceParams((params) => {
          params.delete("status");
          params.delete("type");
        }),
      [replaceParams],
    ),
    openOrder: useCallback((next) => setParam("order", next), [setParam]),
    closeOrder: useCallback(() => setParam("order", undefined), [setParam]),
  };
}
