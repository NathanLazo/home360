import { OrderStatus } from "../../../../../generated/prisma";

type SearchParamValue = string | string[] | undefined;

/**
 * Serialized filters of the corporate views (F2-01 pattern): shareable and
 * refresh-proof. Invalid values normalize to `undefined` without throwing in
 * render.
 */
function singleValue(value: SearchParamValue): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}

export function parseLocationParam(searchParams: {
  location?: SearchParamValue;
}): string | undefined {
  return singleValue(searchParams.location);
}

export function parseOrderStatusParam(searchParams: {
  status?: SearchParamValue;
}): OrderStatus | undefined {
  const status = singleValue(searchParams.status);

  return Object.values(OrderStatus).find((value) => value === status);
}

const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

export function parseMonthParam(searchParams: {
  month?: SearchParamValue;
}): string | undefined {
  const month = singleValue(searchParams.month);

  return month !== undefined && MONTH_PATTERN.test(month) ? month : undefined;
}
