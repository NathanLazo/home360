import { OrderStatus, OrderType } from "@generated/prisma";
import { z } from "zod";

import { recordIdSchema } from "~/schemas/record-id.schema";

export const ORDER_CANCEL_REASON_MIN = 3;
export const ORDER_CANCEL_REASON_MAX = 500;

export const orderIdSchema = z.object({
  id: recordIdSchema,
});

export const orderListSchema = z
  .object({
    branchId: recordIdSchema.optional(),
    status: z.nativeEnum(OrderStatus).optional(),
    type: z.nativeEnum(OrderType).optional(),
    workerId: recordIdSchema.optional(),
    search: z.string().trim().min(1).max(100).optional(),
    /** Inclusive lower bound on `createdAt`. */
    from: z.coerce.date().optional(),
    /** Exclusive upper bound on `createdAt`. */
    to: z.coerce.date().optional(),
    cursor: recordIdSchema.optional(),
  })
  .refine(
    (input) =>
      input.from === undefined ||
      input.to === undefined ||
      input.from.getTime() < input.to.getTime(),
    { path: ["to"], message: "`to` must be after `from`" },
  );

export type OrderListInput = z.infer<typeof orderListSchema>;

export const orderCancelSchema = z.object({
  id: recordIdSchema,
  reason: z
    .string()
    .trim()
    .min(ORDER_CANCEL_REASON_MIN)
    .max(ORDER_CANCEL_REASON_MAX),
});

export type OrderCancelInput = z.infer<typeof orderCancelSchema>;

export const orderAssignWorkerSchema = z.object({
  orderId: recordIdSchema,
  workerId: recordIdSchema,
});

export type OrderAssignWorkerInput = z.infer<typeof orderAssignWorkerSchema>;

/** D10-2: 1–10 delivery photos (kind `evidence`) plus an optional note. */
export const DELIVERY_EVIDENCE_MAX = 10;
export const DELIVERY_NOTE_MAX = 500;

export const orderMarkDeliveredSchema = z.object({
  id: recordIdSchema,
  evidencePathnames: z
    .array(z.string().trim().min(1).max(500))
    .min(1)
    .max(DELIVERY_EVIDENCE_MAX),
  note: z
    .string()
    .trim()
    .max(DELIVERY_NOTE_MAX)
    .optional()
    .transform((value) => (value === "" ? undefined : value)),
});

export type OrderMarkDeliveredInput = z.infer<typeof orderMarkDeliveredSchema>;

/** Scanned QR or typed code; normalized (case, spaces, dashes) server-side. */
export const orderRedeemPickupSchema = z.object({
  code: z.string().trim().min(4).max(32),
});

export type OrderRedeemPickupInput = z.infer<typeof orderRedeemPickupSchema>;
