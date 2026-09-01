import { z } from "zod";

import { ProductStatus } from "@generated/prisma";
import type { ErrorCode } from "~/server/api/contract";

const productStockSchema = z.object({
  branchId: z.string().cuid(),
  stock: z.number().int().min(0).default(0),
  lowStockThreshold: z.number().int().min(0).default(5),
});

const productStocksSchema = z
  .array(productStockSchema)
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
  });

const productFields = {
  name: z.string().trim().min(2).max(120),
  sku: z
    .string()
    .trim()
    .min(1)
    .max(40)
    .regex(/^[A-Za-z0-9][A-Za-z0-9_-]*$/),
  category: z.string().trim().min(2).max(60),
  priceCents: z.number().int().positive(),
};

export const productCreateSchema = z.object({
  ...productFields,
  status: z.nativeEnum(ProductStatus).default(ProductStatus.DRAFT),
  stocks: productStocksSchema.default([]),
});

export const productUpdateSchema = z.object({
  id: z.string().cuid(),
  name: productFields.name.optional(),
  sku: productFields.sku.optional(),
  category: productFields.category.optional(),
  priceCents: productFields.priceCents.optional(),
  stocks: productStocksSchema.optional(),
});

export const productListSchema = z.object({
  search: z.string().trim().min(1).max(100).optional(),
  category: z.string().trim().max(60).optional(),
  status: z.nativeEnum(ProductStatus).optional(),
  lowStockOnly: z.boolean().optional(),
  branchId: z.string().cuid().optional(),
  cursor: z.string().cuid().optional(),
});

export const productCsvErrorCodes = [
  "CSV_FILE_TOO_LARGE",
  "CSV_TOO_MANY_ROWS",
  "CSV_PARSE_ERROR",
  "CSV_MISSING_COLUMN",
  "CSV_INVALID_NAME",
  "CSV_INVALID_SKU",
  "CSV_INVALID_CATEGORY",
  "CSV_INVALID_PRICE",
  "CSV_INVALID_STOCK",
  "CSV_INVALID_LOW_STOCK_THRESHOLD",
  "DUPLICATE_SKU_IN_FILE",
] as const;

export type CsvRowErrorCode = (typeof productCsvErrorCodes)[number];

export const productCsvRowSchema = z.object({
  line: z.number().int().positive(),
  name: productFields.name,
  sku: productFields.sku,
  category: productFields.category,
  priceCents: productFields.priceCents,
  stock: z.number().int().min(0),
  lowStockThreshold: z.number().int().min(0).default(5),
});

export const productImportSchema = z.object({
  rows: z.array(productCsvRowSchema).min(1).max(500),
  branchId: z.string().cuid(),
});

export type ProductCreateInput = z.infer<typeof productCreateSchema>;
export type ProductUpdateInput = z.infer<typeof productUpdateSchema>;
export type ProductListInput = z.infer<typeof productListSchema>;
export type ProductCsvRow = z.infer<typeof productCsvRowSchema>;
export type ProductImportInput = z.infer<typeof productImportSchema>;
export type CsvRowError = { line: number; code: CsvRowErrorCode };
export type ProductErrorCode =
  ErrorCode | "SKU_TAKEN" | "DUPLICATE_SKU_IN_FILE";
