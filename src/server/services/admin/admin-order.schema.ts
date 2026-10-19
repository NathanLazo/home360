import { OrderStatus, OrderType } from "@generated/prisma";
import { z } from "zod";

/** D10-14 `admin.orders.list`: every order of the platform, newest first. */
export const adminOrderListSchema = z
  .object({
    status: z.nativeEnum(OrderStatus).optional(),
    type: z.nativeEnum(OrderType).optional(),
    /** Folio (`123` / `#123`), title, customer or business name. */
    search: z.string().trim().min(1).max(100).optional(),
    cursor: z.string().cuid().optional(),
  })
  .optional();

export type AdminOrderListInput = NonNullable<
  z.infer<typeof adminOrderListSchema>
>;

export const adminOrderIdSchema = z.object({ id: z.string().cuid() });
