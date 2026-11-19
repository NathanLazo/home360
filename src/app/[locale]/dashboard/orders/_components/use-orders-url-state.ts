"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";

export type OrdersUrlState = {
  orderId: string | null;
  openOrder: (orderId: string) => void;
  closeOrder: () => void;
};

/**
 * The open order sheet lives in the URL (`?order=`) so a refresh keeps it and
 * the home dashboard can deep-link straight into an order. The header
 * `?branch=` param is always preserved.
 */
export function useOrdersUrlState(): OrdersUrlState {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
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

  return {
    orderId,
    openOrder: useCallback(
      (nextOrderId) =>
        replaceParams((params) => params.set("order", nextOrderId)),
      [replaceParams],
    ),
    closeOrder: useCallback(
      () => replaceParams((params) => params.delete("order")),
      [replaceParams],
    ),
  };
}
