import type { HeatmapColumn } from "~/components/charts/heatmap";

const DAY_MS = 24 * 60 * 60 * 1_000;

/**
 * Server buckets are UTC midnights. Re-anchor them to the same calendar day
 * in local time so charts (which read local dates) never shift a day back.
 */
export function toLocalDay(date: Date): Date {
  return new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

/** Daily counts → Sunday-first week columns for the bklit heatmap. */
export function toHeatmapColumns(
  days: ReadonlyArray<{ date: Date; count: number }>,
): HeatmapColumn[] {
  const first = days[0];
  if (!first) {
    return [];
  }

  const counts = new Map(
    days.map((day) => [toLocalDay(day.date).getTime(), day.count]),
  );
  const firstDay = toLocalDay(first.date);
  const gridStart = new Date(firstDay);
  gridStart.setDate(firstDay.getDate() - firstDay.getDay());
  const weekCount = Math.ceil((days.length + firstDay.getDay()) / 7);

  return Array.from({ length: weekCount }, (_, column) => ({
    bin: column,
    bins: Array.from({ length: 7 }, (_, row) => {
      const date = new Date(gridStart);
      date.setDate(gridStart.getDate() + column * 7 + row);
      return { bin: row, date, count: counts.get(date.getTime()) ?? 0 };
    }),
  }));
}

/** Seven Sunday-first sample dates, to localize weekday labels via Intl. */
export const SUNDAY_FIRST_WEEK = Array.from(
  { length: 7 },
  // 2023-01-01 was a Sunday.
  (_, index) => new Date(Date.UTC(2023, 0, 1) + index * DAY_MS),
);
