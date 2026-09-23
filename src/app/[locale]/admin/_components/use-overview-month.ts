"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";

import { overviewMonthSchema } from "./overview.schema";

export type OverviewMonthState = {
  /** `undefined` means the month in course. */
  month: string | undefined;
  setMonth: (month: string | undefined) => void;
};

/**
 * The reported month lives in `?month=YYYY-MM` so a refresh or a shared link
 * keeps the same period; the page prefetch reads the very same param.
 */
export function useOverviewMonth(): OverviewMonthState {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const month = useMemo(() => {
    const parsed = overviewMonthSchema.safeParse(searchParams.get("month"));
    return parsed.success ? parsed.data : undefined;
  }, [searchParams]);

  const setMonth = useCallback(
    (nextMonth: string | undefined) => {
      const params = new URLSearchParams(searchParams.toString());

      if (nextMonth === undefined) {
        params.delete("month");
      } else {
        params.set("month", nextMonth);
      }

      const query = params.toString();
      router.replace(query.length > 0 ? `${pathname}?${query}` : pathname, {
        scroll: false,
      });
    },
    [pathname, router, searchParams],
  );

  return { month, setMonth };
}
