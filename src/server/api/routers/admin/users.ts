import {
  approveBusinessSchema,
  exportUsersCsvSchema,
  getBusinessDetailSchema,
  getCustomerDetailSchema,
  listUsersSchema,
  reactivateBusinessSchema,
  reactivateUserSchema,
  rejectBusinessSchema,
  reopenBusinessReviewSchema,
  reviewDocumentSchema,
  suspendBusinessSchema,
  suspendUserSchema,
  USERS_CSV_ROW_CAP,
} from "~/app/[locale]/admin/users/_components/users.schema";
import { PLAN_CODES, planCodeSchema } from "~/lib/subscription/plan-codes";
import { fail, normalizeError, ok } from "~/server/api/contract";
import { adminProcedure, createTRPCRouter } from "~/server/api/trpc";
import { approveBusiness } from "~/server/services/admin/approve-business";
import {
  buildCsvFilename,
  buildUsersCsv,
} from "~/server/services/admin/build-users-csv";
import { getCustomerDetail } from "~/server/services/admin/customer-detail";
import { reactivateBusiness } from "~/server/services/admin/reactivate-business";
import { rejectBusiness } from "~/server/services/admin/reject-business";
import { reopenBusinessReview } from "~/server/services/admin/reopen-business-review";
import { reviewBusinessDocument } from "~/server/services/admin/review-business-document";
import { suspendBusiness } from "~/server/services/admin/suspend-business";
import {
  reactivateUser,
  suspendUser,
} from "~/server/services/admin/user-moderation";
import {
  getBusinessDetail,
  listUsers,
  readCsvRows,
} from "~/server/services/admin/user-directory";
import { ensureBillingSubscription } from "~/server/services/subscription/billing";
import { getStripe } from "~/server/services/stripe/client";

function normalizedFailure(error: unknown, message: string) {
  const normalized = normalizeError(error);
  return fail(normalized.code, normalized.status, message);
}

export const adminUsersRouter = createTRPCRouter({
  list: adminProcedure.input(listUsersSchema).query(async ({ ctx, input }) => {
    try {
      const result = await listUsers({ db: ctx.db }, input);

      if (!result.ok) {
        return fail(result.code, 409, "User directory unavailable");
      }

      return ok(result.data, "User directory loaded");
    } catch (error) {
      return normalizedFailure(error, "User directory query failed");
    }
  }),

  getBusinessDetail: adminProcedure
    .input(getBusinessDetailSchema)
    .query(async ({ ctx, input }) => {
      try {
        const result = await getBusinessDetail({ db: ctx.db }, input);

        if (!result.ok) {
          return fail(result.code, 404, "Business not found");
        }

        return ok(result.data, "Business detail loaded");
      } catch (error) {
        return normalizedFailure(error, "Business detail query failed");
      }
    }),

  exportCsv: adminProcedure
    .input(exportUsersCsvSchema)
    .query(async ({ ctx, input }) => {
      try {
        const { export: rows, truncated } = await readCsvRows(
          { db: ctx.db },
          { filters: input, cap: USERS_CSV_ROW_CAP },
        );

        return ok(
          {
            csv: buildUsersCsv(rows),
            filename: buildCsvFilename(rows.tab, new Date()),
            exportedRows: rows.rows.length,
            truncated,
          },
          "CSV export generated",
        );
      } catch (error) {
        return normalizedFailure(error, "CSV export failed");
      }
    }),

  /**
   * Approval plans are read here instead of reusing `subscription.listPlans`:
   * that procedure is guarded for the BUSINESS role. The Stripe price id is
   * never exposed, only whether the plan is sellable.
   */
  listApprovalPlans: adminProcedure.query(async ({ ctx }) => {
    try {
      const plans = await ctx.db.plan.findMany({
        where: { code: { in: [...PLAN_CODES] } },
        orderBy: { priceCents: "asc" },
        select: {
          code: true,
          priceCents: true,
          commissionPct: true,
          stripePriceId: true,
        },
      });

      return ok(
        // Narrowing `code` here keeps `PlanCode` all the way to the dialog
        // instead of leaking the raw String column into the client.
        plans.flatMap(({ code, stripePriceId, ...plan }) => {
          const parsed = planCodeSchema.safeParse(code);

          return parsed.success
            ? [
                {
                  ...plan,
                  code: parsed.data,
                  isAvailable: stripePriceId !== null,
                },
              ]
            : [];
        }),
        "Approval plans loaded",
      );
    } catch (error) {
      return normalizedFailure(error, "Approval plans query failed");
    }
  }),

  approveBusiness: adminProcedure
    .input(approveBusinessSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const result = await approveBusiness(
          {
            db: ctx.db,
            ensureBillingSubscription: async (billingInput) => {
              const billing = await ensureBillingSubscription(
                { db: ctx.db, stripe: getStripe() },
                billingInput,
              );

              return billing.ok
                ? { ok: true }
                : { ok: false, code: billing.code };
            },
          },
          { ...input, adminId: ctx.session.user.id },
        );

        if (!result.ok) {
          return fail(
            result.code,
            result.code === "NOT_FOUND" ? 404 : 409,
            "Business could not be approved",
          );
        }

        return ok(result.data, "Business approved");
      } catch (error) {
        return normalizedFailure(error, "Business approval failed");
      }
    }),

  rejectBusiness: adminProcedure
    .input(rejectBusinessSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const result = await rejectBusiness(
          { db: ctx.db },
          { ...input, adminId: ctx.session.user.id },
        );

        if (!result.ok) {
          return fail(result.code, 409, "Business could not be rejected");
        }

        return ok(result.data, "Business rejected");
      } catch (error) {
        return normalizedFailure(error, "Business rejection failed");
      }
    }),

  suspendBusiness: adminProcedure
    .input(suspendBusinessSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const result = await suspendBusiness(
          { db: ctx.db },
          { ...input, adminId: ctx.session.user.id },
        );

        if (!result.ok) {
          return fail(result.code, 409, "Business could not be suspended");
        }

        return ok(result.data, "Business suspended");
      } catch (error) {
        return normalizedFailure(error, "Business suspension failed");
      }
    }),

  reactivateBusiness: adminProcedure
    .input(reactivateBusinessSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const result = await reactivateBusiness(
          { db: ctx.db },
          { ...input, adminId: ctx.session.user.id },
        );

        if (!result.ok) {
          return fail(result.code, 409, "Business could not be reactivated");
        }

        return ok(result.data, "Business reactivated");
      } catch (error) {
        return normalizedFailure(error, "Business reactivation failed");
      }
    }),
  reopenBusinessReview: adminProcedure
    .input(reopenBusinessReviewSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const result = await reopenBusinessReview(
          { db: ctx.db },
          { ...input, adminId: ctx.session.user.id },
        );

        if (!result.ok) {
          return fail(
            result.code,
            409,
            "Business review could not be reopened",
          );
        }

        return ok(result.data, "Business review reopened");
      } catch (error) {
        return normalizedFailure(error, "Business review reopen failed");
      }
    }),

  reviewDocument: adminProcedure
    .input(reviewDocumentSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const result = await reviewBusinessDocument(
          { db: ctx.db },
          {
            documentId: input.documentId,
            status: input.status,
            ...(input.notes === undefined ? {} : { notes: input.notes }),
            adminId: ctx.session.user.id,
          },
        );

        if (!result.ok) {
          return fail(
            result.code,
            result.code === "NOT_FOUND" ? 404 : 409,
            "Document could not be reviewed",
          );
        }

        return ok(result.data, "Document reviewed");
      } catch (error) {
        return normalizedFailure(error, "Document review failed");
      }
    }),

  getCustomerDetail: adminProcedure
    .input(getCustomerDetailSchema)
    .query(async ({ ctx, input }) => {
      try {
        const result = await getCustomerDetail({ db: ctx.db }, input);

        if (!result.ok) {
          return fail(result.code, 404, "Customer not found");
        }

        return ok(result.data, "Customer detail loaded");
      } catch (error) {
        return normalizedFailure(error, "Customer detail query failed");
      }
    }),

  suspendUser: adminProcedure
    .input(suspendUserSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const result = await suspendUser(
          { db: ctx.db },
          { ...input, adminId: ctx.session.user.id },
        );

        if (!result.ok) {
          return fail(
            result.code,
            result.code === "NOT_FOUND" ? 404 : 409,
            "User could not be suspended",
          );
        }

        return ok(result.data, "User suspended");
      } catch (error) {
        return normalizedFailure(error, "User suspension failed");
      }
    }),

  reactivateUser: adminProcedure
    .input(reactivateUserSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const result = await reactivateUser(
          { db: ctx.db },
          { ...input, adminId: ctx.session.user.id },
        );

        if (!result.ok) {
          return fail(
            result.code,
            result.code === "NOT_FOUND" ? 404 : 409,
            "User could not be reactivated",
          );
        }

        return ok(result.data, "User reactivated");
      } catch (error) {
        return normalizedFailure(error, "User reactivation failed");
      }
    }),
});
