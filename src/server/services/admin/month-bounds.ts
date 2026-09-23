import { getFinancialMonthBounds } from "../payments/balances";

export type MonthBounds = { start: Date; end: Date };

/**
 * Resolves "YYYY-MM" against the platform's financial calendar. `undefined`
 * means the month containing `now`; a malformed value resolves to `null`.
 * Shared by the admin overview (W9) and finance (W12) KPIs.
 */
export function boundsForMonth(
  month: string | undefined,
  now: Date,
): MonthBounds | null {
  if (month === undefined) {
    return getFinancialMonthBounds(now);
  }

  const [year, monthNumber] = month.split("-").map(Number);

  if (
    year === undefined ||
    monthNumber === undefined ||
    Number.isNaN(year) ||
    Number.isNaN(monthNumber) ||
    monthNumber < 1 ||
    monthNumber > 12
  ) {
    return null;
  }

  // Midday avoids landing outside the month through any UTC offset.
  const anchor = new Date(Date.UTC(year, monthNumber - 1, 15, 12));
  return getFinancialMonthBounds(anchor);
}

/**
 * One millisecond before the current month start always lands inside the
 * previous month, whatever its length or DST offset.
 */
export function previousMonthBounds(currentStart: Date): MonthBounds {
  return getFinancialMonthBounds(new Date(currentStart.getTime() - 1));
}
