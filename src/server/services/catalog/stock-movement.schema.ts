import { z } from "zod";

import { recordIdSchema } from "~/schemas/record-id.schema";

/** `product.listStockMovements` input (F10-b ledger, cursor = movement id). */
export const stockMovementListSchema = z.object({
  productId: recordIdSchema,
  branchId: recordIdSchema.optional(),
  cursor: recordIdSchema.optional(),
});

export type StockMovementListInput = z.infer<typeof stockMovementListSchema>;
