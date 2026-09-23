"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";

import { ordersTabSchema, type OrdersTab } from "./orders.schema";

export type OrdersUrlState = {
  tab: OrdersTab;
  orderId: string | null;
  requestId: string | null;
  setTab: (tab: OrdersTab) => void;
  openOrder: (orderId: string) => void;
  closeOrder: () => void;
  openRequest: (requestId: string) => void;
  closeRequest: () => void;
};

/**
 * Tab and open sheets live in the URL (`?tab=`, `?order=`, `?request=`) so a
 * refresh keeps the screen and the home dashboard can deep-link straight into
 * an order. The header `?branch=` param is always preserved.
 */
export function useOrdersUrlState(): OrdersUrlState {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const tab = useMemo(() => {
    const parsed = ordersTabSchema.safeParse(searchParams.get("tab"));
    return parsed.success ? parsed.data : "orders";
  }, [searchParams]);

  const orderId = searchParams.get("order");
  const requestId = searchParams.get("request");

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
    orderId,
    requestId,
    setTab: useCallback(
      (nextTab) =>
        replaceParams((params) => {
          if (nextTab === "orders") params.delete("tab");
          else params.set("tab", nextTab);
          params.delete("order");
          params.delete("request");
        }),
      [replaceParams],
    ),
    openOrder: useCallback(
      (nextOrderId) =>
        replaceParams((params) => params.set("order", nextOrderId)),
      [replaceParams],
    ),
    closeOrder: useCallback(
      () => replaceParams((params) => params.delete("order")),
      [replaceParams],
    ),
    openRequest: useCallback(
      (nextRequestId) =>
        replaceParams((params) => params.set("request", nextRequestId)),
      [replaceParams],
    ),
    closeRequest: useCallback(
      () => replaceParams((params) => params.delete("request")),
      [replaceParams],
    ),
  };
}
