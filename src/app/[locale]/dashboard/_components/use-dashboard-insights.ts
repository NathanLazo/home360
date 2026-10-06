"use client";

import { keepPreviousData } from "@tanstack/react-query";

import type { DashboardRangeDays } from "~/lib/search-params";
import { unwrapEnvelope } from "~/lib/trpc-envelope";
import { api } from "~/trpc/react";

/**
 * Shared `getInsights` query for the trend, funnel and activity cards. The
 * input must match the server prefetch in `dashboard/page.tsx` exactly.
 */
export function useDashboardInsights(
  branchId: string | undefined,
  days: DashboardRangeDays,
) {
  const input = branchId ? { branchId, days } : { days };
  const query = api.dashboard.getInsights.useQuery(input, {
    placeholderData: keepPreviousData,
  });

  return {
    state: unwrapEnvelope(query),
    isRefreshing: query.isPlaceholderData,
    retry: () => void query.refetch(),
  };
}
