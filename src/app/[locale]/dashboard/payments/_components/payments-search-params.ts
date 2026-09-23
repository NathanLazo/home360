import { z } from "zod";

/**
 * URL contract of the payments screen. Shared by the server page (prefetch)
 * and the client view (tab state), so both read `?tab=` and `?branch=` the
 * same way. Anything invalid falls back to the default instead of throwing.
 */
export const PAYMENTS_TABS = [
  "transactions",
  "links",
  "withdrawals",
  "bonuses",
] as const;

export type PaymentsTab = (typeof PAYMENTS_TABS)[number];

export const DEFAULT_PAYMENTS_TAB: PaymentsTab = "transactions";

const paymentsTabSchema = z.enum(PAYMENTS_TABS);
const branchIdSchema = z.string().trim().cuid();

export function parsePaymentsTab(value: unknown): PaymentsTab {
  const parsed = paymentsTabSchema.safeParse(value);
  return parsed.success ? parsed.data : DEFAULT_PAYMENTS_TAB;
}

/** `?branch=` from the header selector; only a well-formed id scopes queries. */
export function parsePaymentsBranch(value: unknown): string | undefined {
  const parsed = branchIdSchema.safeParse(value);
  return parsed.success ? parsed.data : undefined;
}
