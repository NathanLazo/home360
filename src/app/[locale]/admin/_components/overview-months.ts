/**
 * Pure "YYYY-MM" arithmetic for the W9 month selector. The server decides
 * which month is in course (financial time zone), so the client never needs
 * to know the platform's calendar: it only walks back from that key.
 */
export function recentMonthKeys(currentMonth: string, count: number): string[] {
  const [year, month] = currentMonth.split("-").map(Number);

  if (year === undefined || month === undefined) {
    return [currentMonth];
  }

  return Array.from({ length: count }, (_, offset) => {
    const index = year * 12 + (month - 1) - offset;
    const keyYear = Math.floor(index / 12);
    const keyMonth = (index % 12) + 1;
    return `${keyYear}-${String(keyMonth).padStart(2, "0")}`;
  });
}

/** Mid-month UTC instant: formats as the same month in every time zone. */
export function monthKeyAnchor(monthKey: string): Date {
  const [year, month] = monthKey.split("-").map(Number);
  return new Date(Date.UTC(year ?? 1970, (month ?? 1) - 1, 15, 12));
}
