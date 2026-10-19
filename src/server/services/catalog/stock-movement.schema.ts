import { z } from "zod";

/** `product.listStockMovements` input (F10-b ledger, cursor = movement id). */
export const stockMovementListSchema = z.object({
  productId: z.string().cuid(),
  branchId: z.string().cuid().optional(),
  cursor: z.string().cuid().optional(),
});

export type StockMovementListInput = z.infer<typeof stockMovementListSchema>;
