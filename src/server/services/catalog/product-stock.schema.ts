import { z } from "zod";

/**
 * `product.adjustStock` input (D10-4). Same rows as the dashboard form plus
 * an optional per-row `expectedStock` precondition: when sent, the write is
 * compare-and-set against the current available stock and a stale value
 * answers CONFLICT. Rows without it keep the legacy absolute write.
 */
const stockAdjustRowSchema = z.object({
  branchId: z.string().cuid(),
  stock: z.number().int().min(0).default(0),
  lowStockThreshold: z.number().int().min(0).default(5),
  expectedStock: z.number().int().min(0).optional(),
});

export const productStockAdjustSchema = z.object({
  id: z.string().cuid(),
  stocks: z
    .array(stockAdjustRowSchema)
    .max(100)
    .superRefine((stocks, context) => {
      const branchIds = new Set<string>();

      stocks.forEach((stock, index) => {
        if (branchIds.has(stock.branchId)) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Duplicate branch",
            path: [index, "branchId"],
          });
        }

        branchIds.add(stock.branchId);
      });
    }),
});

export type ProductStockAdjustInput = z.infer<typeof productStockAdjustSchema>;
