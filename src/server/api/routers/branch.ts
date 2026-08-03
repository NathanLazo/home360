import {
  branchCreateSchema,
  branchIdSchema,
  branchSetStatusSchema,
  branchUpdateSchema,
} from "~/app/[locale]/dashboard/branches/_components/branch.schema";
import { fail, normalizeError } from "~/server/api/contract";
import {
  activeBusinessProcedure,
  businessProcedure,
  createTRPCRouter,
} from "~/server/api/trpc";
import {
  createBranch,
  deleteBranch,
  listBranches,
  setBranchStatus,
  updateBranch,
} from "~/server/services/business/branch-directory";

function branchFailure(error: unknown) {
  const normalized = normalizeError(error);
  return fail(normalized.code, normalized.status, "Branch operation failed");
}

export const branchRouter = createTRPCRouter({
  list: businessProcedure.query(async ({ ctx }) => {
    try {
      return await listBranches(ctx.db, ctx.business);
    } catch (error) {
      return branchFailure(error);
    }
  }),

  create: activeBusinessProcedure
    .input(branchCreateSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        return await createBranch(ctx.db, ctx.business, input);
      } catch (error) {
        return branchFailure(error);
      }
    }),

  update: activeBusinessProcedure
    .input(branchUpdateSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        return await updateBranch(ctx.db, ctx.business.id, input);
      } catch (error) {
        return branchFailure(error);
      }
    }),

  setStatus: activeBusinessProcedure
    .input(branchSetStatusSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        return await setBranchStatus(ctx.db, ctx.business.id, input);
      } catch (error) {
        return branchFailure(error);
      }
    }),

  delete: activeBusinessProcedure
    .input(branchIdSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        return await deleteBranch(ctx.db, ctx.business.id, input.id);
      } catch (error) {
        return branchFailure(error);
      }
    }),
});
