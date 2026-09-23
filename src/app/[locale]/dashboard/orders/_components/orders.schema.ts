import { z } from "zod";

export const ordersTabSchema = z.enum(["orders", "requests", "offers"]);
export type OrdersTab = z.infer<typeof ordersTabSchema>;

export const quoteStatusFilterSchema = z.enum([
  "PENDING",
  "ACCEPTED",
  "REJECTED",
  "EXPIRED",
  "WITHDRAWN",
]);
export type QuoteStatusFilter = z.infer<typeof quoteStatusFilterSchema>;

/** Mirrors `orderCancelSchema.reason` on the server. */
export const orderCancelReasonSchema = z.string().trim().min(3).max(500);

export const OFFER_MESSAGE_MAX = 500;

/**
 * Client-side mirror of `quote.submit`: amounts are typed in pesos and the
 * schedule comes from a `datetime-local` input (viewer's local time).
 */
export const offerFormSchema = z.object({
  workerId: z.string().cuid(),
  price: z.coerce.number().positive().max(10_000_000),
  scheduledAt: z
    .string()
    .min(1)
    .transform((value) => new Date(value))
    .refine((date) => !Number.isNaN(date.getTime()))
    .refine((date) => date.getTime() > Date.now()),
  message: z.string().trim().max(OFFER_MESSAGE_MAX),
});

export type OfferFormValues = {
  workerId: string;
  price: string;
  scheduledAt: string;
  message: string;
};

export type OfferFormField = keyof OfferFormValues;
