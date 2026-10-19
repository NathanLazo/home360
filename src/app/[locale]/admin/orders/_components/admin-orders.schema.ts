import { z } from "zod";

import type { RouterInputs } from "~/trpc/react";

// The whole input is optional on the router, so tRPC infers `void | {…}`.
type AdminOrderListInput = Exclude<
  RouterInputs["admin"]["orders"]["list"],
  void | undefined
>;

/**
 * URL filters of `/admin/orders` (D10-14). Literal values mirror the Prisma
 * enums on purpose (importing the generated client from a client component
 * would ship the Prisma runtime); `satisfies` keeps them in step with the
 * router input.
 */
export const ADMIN_ORDER_STATUSES = [
  "PENDING",
  "PAID",
  "IN_PROGRESS",
  "SHIPPING",
  "COMPLETED",
  "CANCELLED",
  "DISPUTED",
] as const satisfies ReadonlyArray<NonNullable<AdminOrderListInput["status"]>>;

export const ADMIN_ORDER_TYPES = [
  "SERVICE",
  "PRODUCT",
] as const satisfies ReadonlyArray<NonNullable<AdminOrderListInput["type"]>>;

export const adminOrderStatusSchema = z.enum(ADMIN_ORDER_STATUSES);
export const adminOrderTypeSchema = z.enum(ADMIN_ORDER_TYPES);

export type AdminOrderStatusValue = z.infer<typeof adminOrderStatusSchema>;
export type AdminOrderTypeValue = z.infer<typeof adminOrderTypeSchema>;

/** Same bound as the router's `search` (folio, title, customer, business). */
export const ADMIN_ORDER_SEARCH_MAX = 100;

/** Builds the exact input the page prefetches, so hydration hits the cache. */
export function toAdminOrderListInput(filters: {
  status: AdminOrderStatusValue | undefined;
  type: AdminOrderTypeValue | undefined;
  search: string;
}): AdminOrderListInput {
  const search = filters.search.trim();

  return {
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.type ? { type: filters.type } : {}),
    ...(search.length > 0 ? { search } : {}),
  };
}
