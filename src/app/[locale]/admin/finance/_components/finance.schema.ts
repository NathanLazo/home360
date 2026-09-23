import { z } from "zod";

import {
  LoyaltyBonusStatus,
  LoyaltyPayoutMethod,
  WithdrawalStatus,
} from "@generated/prisma";

/** "YYYY-MM" in the platform's financial time zone; defaults to this month. */
export const financeMonthSchema = z.string().regex(/^\d{4}-\d{2}$/u);

export const financeKpisSchema = z
  .object({ month: financeMonthSchema.optional() })
  .strict();

export const withdrawalStatusSchema = z.nativeEnum(WithdrawalStatus);

/**
 * "pending" is the approval queue (REQUESTED only); "history" is everything
 * already decided or in flight, filterable by status, business and date.
 */
export const WITHDRAWAL_VIEWS = ["pending", "history"] as const;

export const withdrawalViewSchema = z.enum(WITHDRAWAL_VIEWS);

export type WithdrawalView = z.infer<typeof withdrawalViewSchema>;

/** Statuses the history view may be narrowed to (never REQUESTED). */
export const WITHDRAWAL_HISTORY_STATUSES = [
  WithdrawalStatus.PROCESSING,
  WithdrawalStatus.APPROVED,
  WithdrawalStatus.REJECTED,
  WithdrawalStatus.FAILED,
  WithdrawalStatus.CANCELED,
] as const;

export const withdrawalHistoryStatusSchema = z.enum(
  WITHDRAWAL_HISTORY_STATUSES,
);

/** Inclusive calendar day "YYYY-MM-DD" typed in a date input. */
export const withdrawalDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/u);

export const listWithdrawalsSchema = z
  .object({
    view: withdrawalViewSchema.default("pending"),
    status: withdrawalHistoryStatusSchema.optional(),
    business: z.string().trim().max(100).optional(),
    from: withdrawalDateSchema.optional(),
    to: withdrawalDateSchema.optional(),
    cursor: z.string().cuid().optional(),
  })
  .strict();

export type ListWithdrawalsInput = z.input<typeof listWithdrawalsSchema>;

export const revenueBreakdownSchema = z
  .object({
    months: z.number().int().min(1).max(12).default(6),
    /** Last month of the window; defaults to the current month. */
    month: financeMonthSchema.optional(),
  })
  .strict();

export const withdrawalReasonSchema = z.string().trim().min(5).max(500);

export const approveWithdrawalSchema = z
  .object({ withdrawalId: z.string().cuid() })
  .strict();

export const rejectWithdrawalSchema = z
  .object({
    withdrawalId: z.string().cuid(),
    reason: withdrawalReasonSchema,
  })
  .strict();

/** Width of the W12 revenue window, ending on the selected month. */
export const REVENUE_MONTHS = 6;

export const WITHDRAWALS_PAGE_SIZE = 20;

export const LOYALTY_BONUSES_PAGE_SIZE = 20;

export const loyaltyBonusStatusSchema = z.nativeEnum(LoyaltyBonusStatus);

export const listLoyaltyBonusesSchema = z
  .object({
    status: loyaltyBonusStatusSchema.optional(),
    businessId: z.string().cuid().optional(),
    cursor: z.string().cuid().optional(),
  })
  .strict();

export const payLoyaltyBonusSchema = z
  .object({
    bonusId: z.string().cuid(),
    method: z.nativeEnum(LoyaltyPayoutMethod),
    notes: z.string().trim().max(500).optional(),
  })
  .strict();

export const loyaltyCancelReasonSchema = z.string().trim().min(5).max(500);

export const cancelLoyaltyBonusSchema = z
  .object({
    bonusId: z.string().cuid(),
    reason: loyaltyCancelReasonSchema,
  })
  .strict();
