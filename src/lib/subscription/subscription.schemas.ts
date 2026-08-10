import { z } from "zod";

import { planCodeSchema } from "./plan-codes";

/**
 * Domain error codes emitted by the `subscription` router on top of the shared
 * `ERROR_CODES`. They are stable literals so the UI translates them from
 * `errors.json` without ever reading a server message.
 *
 * `PLAN_LIMIT_REACHED` is not listed here: it already belongs to `ERROR_CODES`,
 * and the detail of *what* exceeds the target plan travels in the successful
 * result of `previewChange`, never inside an error.
 */
export const subscriptionErrorCodes = [
  "NO_SUBSCRIPTION",
  "PLAN_NOT_FOUND",
  "PLAN_NOT_SYNCED",
  "SAME_PLAN",
  "SUBSCRIPTION_NOT_ACTIVE",
] as const;

export type SubscriptionErrorCode = (typeof subscriptionErrorCodes)[number];

export const planChangeSchema = z.object({ planCode: planCodeSchema });

export const listInvoicesSchema = z.object({
  cursor: z.string().cuid().optional(),
});
