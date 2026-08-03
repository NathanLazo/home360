import { OrderStatus, OrderType } from "../../../../generated/prisma";
import { z } from "zod";

export const orderIdSchema = z.object({
  id: z.string().cuid(),
});

export const orderListSchema = z.object({
  branchId: z.string().cuid().optional(),
  status: z.nativeEnum(OrderStatus).optional(),
  type: z.nativeEnum(OrderType).optional(),
  search: z.string().trim().min(1).max(100).optional(),
  cursor: z.string().cuid().optional(),
});

export type OrderListInput = z.infer<typeof orderListSchema>;
