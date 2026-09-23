import { OrderStatus, OrderType } from "@generated/prisma";
import { z } from "zod";

export const ORDER_CANCEL_REASON_MIN = 3;
export const ORDER_CANCEL_REASON_MAX = 500;

export const orderIdSchema = z.object({
  id: z.string().cuid(),
});

export const orderListSchema = z
  .object({
    branchId: z.string().cuid().optional(),
    status: z.nativeEnum(OrderStatus).optional(),
    type: z.nativeEnum(OrderType).optional(),
    workerId: z.string().cuid().optional(),
    search: z.string().trim().min(1).max(100).optional(),
    /** Inclusive lower bound on `createdAt`. */
    from: z.coerce.date().optional(),
    /** Exclusive upper bound on `createdAt`. */
    to: z.coerce.date().optional(),
    cursor: z.string().cuid().optional(),
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
  id: z.string().cuid(),
  reason: z
    .string()
    .trim()
    .min(ORDER_CANCEL_REASON_MIN)
    .max(ORDER_CANCEL_REASON_MAX),
});

export type OrderCancelInput = z.infer<typeof orderCancelSchema>;

export const orderAssignWorkerSchema = z.object({
  orderId: z.string().cuid(),
  workerId: z.string().cuid(),
});

export type OrderAssignWorkerInput = z.infer<typeof orderAssignWorkerSchema>;
