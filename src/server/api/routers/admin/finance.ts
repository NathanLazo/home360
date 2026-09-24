import {
  approveWithdrawalSchema,
  cancelLoyaltyBonusSchema,
  financeKpisSchema,
  listLoyaltyBonusesSchema,
  listWithdrawalsSchema,
  payLoyaltyBonusSchema,
  rejectWithdrawalSchema,
  revenueBreakdownSchema,
} from "~/app/[locale]/admin/finance/_components/finance.schema";
import {
  cancelLoyaltyBonus,
  listLoyaltyBonuses,
  payLoyaltyBonus,
} from "~/server/services/admin/loyalty-payouts";
import { fail, normalizeError, ok } from "~/server/api/contract";
import {
  adminListBusinessTransactionsSchema,
  getBusinessFinanceSchema,
  getWithdrawalSchema,
} from "~/schemas/admin/business-finance.schema";
import {
  getPayoutReceiptUrlSchema,
  listPayoutReceiptsSchema,
  registerPayoutReceiptsSchema,
} from "~/schemas/admin/payout-receipt.schema";
import { adminProcedure, createTRPCRouter } from "~/server/api/trpc";
import {
  getBusinessFinance,
  getWithdrawalDetail,
} from "~/server/services/admin/business-finance";
import {
  getFinanceKpis,
  getRevenueBreakdown,
  listWithdrawals,
} from "~/server/services/admin/finance-kpis";
import {
  getPayoutReceiptUrl,
  listPayoutReceipts,
  registerPayoutReceipts,
} from "~/server/services/admin/payout-receipts";
import { listBusinessTransactions } from "~/server/services/payments/transaction-history";
import {
  approveWithdrawal,
  rejectWithdrawal,
} from "~/server/services/payments/withdrawals";
import { getStripe } from "~/server/services/stripe/client";

function normalizedFailure(error: unknown, message: string) {
  const normalized = normalizeError(error);
  return fail(normalized.code, normalized.status, message);
}

export const adminFinanceRouter = createTRPCRouter({
  getKpis: adminProcedure
    .input(financeKpisSchema)
    .query(async ({ ctx, input }) => {
      try {
        const result = await getFinanceKpis({ db: ctx.db }, input);

        if (!result.ok) {
          return fail(result.code, 400, "Finance KPIs unavailable");
        }

        return ok(result.data, "Finance KPIs loaded");
      } catch (error) {
        return normalizedFailure(error, "Finance KPIs query failed");
      }
    }),

  listWithdrawals: adminProcedure
    .input(listWithdrawalsSchema)
    .query(async ({ ctx, input }) => {
      try {
        const result = await listWithdrawals({ db: ctx.db }, input);

        if (!result.ok) {
          return fail(result.code, 409, "Withdrawals unavailable");
        }

        return ok(result.data, "Withdrawals loaded");
      } catch (error) {
        return normalizedFailure(error, "Withdrawals query failed");
      }
    }),

  getRevenueBreakdown: adminProcedure
    .input(revenueBreakdownSchema)
    .query(async ({ ctx, input }) => {
      try {
        const result = await getRevenueBreakdown({ db: ctx.db }, input);

        if (!result.ok) {
          return fail(result.code, 409, "Revenue breakdown unavailable");
        }

        return ok(result.data, "Revenue breakdown loaded");
      } catch (error) {
        return normalizedFailure(error, "Revenue breakdown query failed");
      }
    }),

  listLoyaltyBonuses: adminProcedure
    .input(listLoyaltyBonusesSchema)
    .query(async ({ ctx, input }) => {
      try {
        const result = await listLoyaltyBonuses({ db: ctx.db }, input);

        if (!result.ok) {
          return fail(result.code, 409, "Loyalty bonuses unavailable");
        }

        return ok(result.data, "Loyalty bonuses loaded");
      } catch (error) {
        return normalizedFailure(error, "Loyalty bonuses query failed");
      }
    }),

  payLoyaltyBonus: adminProcedure
    .input(payLoyaltyBonusSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const result = await payLoyaltyBonus(
          { db: ctx.db },
          { ...input, adminId: ctx.session.user.id },
        );

        if (!result.ok) {
          return fail(
            result.code,
            result.code === "NOT_FOUND" ? 404 : 409,
            "Bonus could not be settled",
          );
        }

        return ok(result.data, "Loyalty bonus settled");
      } catch (error) {
        return normalizedFailure(error, "Loyalty bonus settlement failed");
      }
    }),

  cancelLoyaltyBonus: adminProcedure
    .input(cancelLoyaltyBonusSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const result = await cancelLoyaltyBonus(
          { db: ctx.db },
          { ...input, adminId: ctx.session.user.id },
        );

        if (!result.ok) {
          return fail(
            result.code,
            result.code === "NOT_FOUND" ? 404 : 409,
            "Bonus could not be cancelled",
          );
        }

        return ok(result.data, "Loyalty bonus cancelled");
      } catch (error) {
        return normalizedFailure(error, "Loyalty bonus cancellation failed");
      }
    }),

  /**
   * Thin wrapper: the Payout, its idempotency key and the status machine all
   * live in the F3 withdrawal service (XC-08 contract).
   */
  approveWithdrawal: adminProcedure
    .input(approveWithdrawalSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const result = await approveWithdrawal(
          { db: ctx.db, stripe: getStripe() },
          { ...input, adminId: ctx.session.user.id },
        );

        if (!result.ok) {
          return fail(
            result.code,
            result.code === "NOT_FOUND"
              ? 404
              : result.code === "STRIPE_ERROR"
                ? 502
                : 409,
            "Withdrawal could not be approved",
          );
        }

        return ok({ id: result.data.withdrawalId }, "Withdrawal approved");
      } catch (error) {
        return normalizedFailure(error, "Withdrawal approval failed");
      }
    }),

  rejectWithdrawal: adminProcedure
    .input(rejectWithdrawalSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const result = await rejectWithdrawal(
          { db: ctx.db },
          { ...input, adminId: ctx.session.user.id },
        );

        if (!result.ok) {
          return fail(
            result.code,
            result.code === "NOT_FOUND" ? 404 : 409,
            "Withdrawal could not be rejected",
          );
        }

        return ok({ id: result.data.withdrawalId }, "Withdrawal rejected");
      } catch (error) {
        return normalizedFailure(error, "Withdrawal rejection failed");
      }
    }),

  getBusinessFinance: adminProcedure
    .input(getBusinessFinanceSchema)
    .query(async ({ ctx, input }) => {
      try {
        const result = await getBusinessFinance({ db: ctx.db }, input);

        if (!result.ok) {
          return fail(
            result.code,
            result.code === "NOT_FOUND" ? 404 : 409,
            "Business finance unavailable",
          );
        }

        return ok(result.data, "Business finance loaded");
      } catch (error) {
        return normalizedFailure(error, "Business finance query failed");
      }
    }),

  getWithdrawal: adminProcedure
    .input(getWithdrawalSchema)
    .query(async ({ ctx, input }) => {
      try {
        const result = await getWithdrawalDetail({ db: ctx.db }, input);

        if (!result.ok) {
          return fail(result.code, 404, "Withdrawal not found");
        }

        return ok(result.data, "Withdrawal loaded");
      } catch (error) {
        return normalizedFailure(error, "Withdrawal query failed");
      }
    }),

  listBusinessTransactions: adminProcedure
    .input(adminListBusinessTransactionsSchema)
    .query(async ({ ctx, input }) => {
      try {
        const result = await listBusinessTransactions({ db: ctx.db }, input);

        if (!result.ok) {
          return fail(
            result.code,
            result.code === "NOT_FOUND" ? 404 : 409,
            "Business transactions unavailable",
          );
        }

        return ok(result.data, "Business transactions loaded");
      } catch (error) {
        return normalizedFailure(error, "Business transactions query failed");
      }
    }),

  registerPayoutReceipts: adminProcedure
    .input(registerPayoutReceiptsSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const result = await registerPayoutReceipts(
          { db: ctx.db },
          { ...input, adminId: ctx.session.user.id },
        );

        if (!result.ok) {
          return fail(
            result.code,
            result.code === "NOT_FOUND" ? 404 : 409,
            "Receipts could not be registered",
          );
        }

        return ok(result.data, "Payment receipts registered");
      } catch (error) {
        return normalizedFailure(error, "Receipt registration failed");
      }
    }),

  listPayoutReceipts: adminProcedure
    .input(listPayoutReceiptsSchema)
    .query(async ({ ctx, input }) => {
      try {
        const result = await listPayoutReceipts({ db: ctx.db }, input);

        if (!result.ok) {
          return fail(result.code, 409, "Receipts unavailable");
        }

        return ok(result.data, "Payment receipts loaded");
      } catch (error) {
        return normalizedFailure(error, "Receipts query failed");
      }
    }),

  getPayoutReceiptUrl: adminProcedure
    .input(getPayoutReceiptUrlSchema)
    .query(async ({ ctx, input }) => {
      try {
        const result = await getPayoutReceiptUrl({ db: ctx.db }, input);

        if (!result.ok) {
          return fail(
            result.code,
            result.code === "NOT_FOUND" ? 404 : 500,
            "Receipt URL unavailable",
          );
        }

        return ok(result.data, "Receipt URL issued");
      } catch (error) {
        return normalizedFailure(error, "Receipt URL request failed");
      }
    }),
});
