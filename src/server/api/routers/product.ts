import { ProductStatus } from "@generated/prisma";
import { z } from "zod";

import {
  productCreateSchema,
  productImportSchema,
  productListSchema,
  productUpdateSchema,
  type ProductErrorCode,
} from "~/app/[locale]/dashboard/products/_components/product.schema";
import { fail, normalizeError, type TrpcResponse } from "~/server/api/contract";
import {
  activeBusinessProcedure,
  businessProcedure,
  createTRPCRouter,
} from "~/server/api/trpc";
import {
  createProduct,
  deleteProduct,
  getProductStockByBranch,
  importProductRows,
  listProductCategories,
  listProducts,
  listProductStockBranches,
  setProductStatus,
  updateProduct,
} from "~/server/services/catalog/product-catalog";

const productIdSchema = z.object({ id: z.string().cuid() });
const productStockSchema = z.object({ productId: z.string().cuid() });
const productStatusSchema = productIdSchema.extend({
  status: z.nativeEnum(ProductStatus),
});

function productFailure(error: unknown): TrpcResponse<never, ProductErrorCode> {
  const normalized = normalizeError(error);
  return fail<never, ProductErrorCode>(
    normalized.code,
    normalized.status,
    "Product operation failed",
  );
}

export const productRouter = createTRPCRouter({
  list: businessProcedure
    .input(productListSchema)
    .query(async ({ ctx, input }) => {
      try {
        return await listProducts(ctx.db, ctx.business.id, input);
      } catch (error) {
        return productFailure(error);
      }
    }),

  listStockBranches: businessProcedure.query(async ({ ctx }) => {
    try {
      return await listProductStockBranches(ctx.db, ctx.business.id);
    } catch (error) {
      return productFailure(error);
    }
  }),

  getStockByBranch: businessProcedure
    .input(productStockSchema)
    .query(async ({ ctx, input }) => {
      try {
        return await getProductStockByBranch(
          ctx.db,
          ctx.business.id,
          input.productId,
        );
      } catch (error) {
        return productFailure(error);
      }
    }),

  listCategories: businessProcedure.query(async ({ ctx }) => {
    try {
      return await listProductCategories(ctx.db, ctx.business.id);
    } catch (error) {
      return productFailure(error);
    }
  }),

  create: activeBusinessProcedure
    .input(productCreateSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        return await createProduct(ctx.db, ctx.business, input);
      } catch (error) {
        return productFailure(error);
      }
    }),

  importCsv: activeBusinessProcedure
    .input(productImportSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        return await importProductRows(
          ctx.db,
          ctx.business.id,
          input.branchId,
          input.rows,
        );
      } catch (error) {
        return productFailure(error);
      }
    }),

  update: activeBusinessProcedure
    .input(productUpdateSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        return await updateProduct(ctx.db, ctx.business.id, input);
      } catch (error) {
        return productFailure(error);
      }
    }),

  setStatus: activeBusinessProcedure
    .input(productStatusSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        return await setProductStatus(ctx.db, ctx.business, input);
      } catch (error) {
        return productFailure(error);
      }
    }),

  delete: activeBusinessProcedure
    .input(productIdSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        return await deleteProduct(ctx.db, ctx.business.id, input.id);
      } catch (error) {
        return productFailure(error);
      }
    }),
});
