/** Parses a native `<input type="date">` value as local midnight. */
function parseLocalDate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

  if (!match) {
    return null;
  }

  const date = new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
  );

  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Converts the inclusive day range of the filters into the list contract:
 * `from` = start of the first day, `to` = start of the day AFTER the last one
 * (exclusive). An inverted range is dropped instead of failing the query.
 */
export function toOrderListDateRange(
  from: string,
  to: string,
): { from?: Date; to?: Date } {
  const start = parseLocalDate(from);
  const endDay = parseLocalDate(to);
  const end = endDay
    ? new Date(endDay.getFullYear(), endDay.getMonth(), endDay.getDate() + 1)
    : null;

  if (start && end && start.getTime() >= end.getTime()) {
    return {};
  }

  return {
    ...(start ? { from: start } : {}),
    ...(end ? { to: end } : {}),
  };
}
