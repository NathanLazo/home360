"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";

import { requestsTabSchema, type RequestsTab } from "./requests.schema";

export type RequestsUrlState = {
  tab: RequestsTab;
  requestId: string | null;
  setTab: (tab: RequestsTab) => void;
  openRequest: (requestId: string) => void;
  closeRequest: () => void;
};

/**
 * Tab and open request sheet live in the URL (`?tab=`, `?request=`) so a
 * refresh keeps the screen and push/notification links can deep-link into a
 * request. The header `?branch=` param is always preserved.
 */
export function useRequestsUrlState(): RequestsUrlState {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const tab = useMemo(() => {
    const parsed = requestsTabSchema.safeParse(searchParams.get("tab"));
    return parsed.success ? parsed.data : "radar";
  }, [searchParams]);
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
    requestId,
    setTab: useCallback(
      (nextTab) =>
        replaceParams((params) => {
          if (nextTab === "radar") params.delete("tab");
          else params.set("tab", nextTab);
          params.delete("request");
        }),
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
