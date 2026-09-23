export function parseBranchParam(searchParams: {
  branch?: string | string[];
}): string | undefined {
  const { branch } = searchParams;

  if (typeof branch !== "string") {
    return undefined;
  }

  const normalizedBranch = branch.trim();
  return normalizedBranch.length > 0 ? normalizedBranch : undefined;
}

/** Dashboard home date ranges (days), selectable from the header. */
export const DASHBOARD_RANGE_OPTIONS = [7, 30, 90] as const;

export type DashboardRangeDays = (typeof DASHBOARD_RANGE_OPTIONS)[number];

export const DEFAULT_DASHBOARD_RANGE: DashboardRangeDays = 30;

export function isDashboardRange(value: number): value is DashboardRangeDays {
  return (DASHBOARD_RANGE_OPTIONS as readonly number[]).includes(value);
}

/** Reads `?range=7|30|90`; anything else falls back to the 30-day default. */
export function parseRangeParam(searchParams: {
  range?: string | string[] | null;
}): DashboardRangeDays {
  const { range } = searchParams;

  if (typeof range !== "string") {
    return DEFAULT_DASHBOARD_RANGE;
  }

  const days = Number(range.trim());
  return isDashboardRange(days) ? days : DEFAULT_DASHBOARD_RANGE;
}

/** Whole weeks the weekly revenue chart shows for a range (7 → 1, 90 → 13). */
export function rangeToWeeks(days: DashboardRangeDays): number {
  return Math.ceil(days / 7);
}
