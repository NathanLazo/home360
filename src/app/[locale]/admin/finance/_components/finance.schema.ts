import { z } from "zod";

import {
  LoyaltyBonusStatus,
  LoyaltyPayoutMethod,
  WithdrawalStatus,
} from "../../../../../../generated/prisma";

/** "YYYY-MM" in the platform's financial time zone; defaults to this month. */
export const financeMonthSchema = z.string().regex(/^\d{4}-\d{2}$/u);

export const financeKpisSchema = z
  .object({ month: financeMonthSchema.optional() })
  .strict();

export const withdrawalStatusSchema = z.nativeEnum(WithdrawalStatus);

export const listWithdrawalsSchema = z
  .object({
    status: withdrawalStatusSchema.optional(),
    cursor: z.string().cuid().optional(),
  })
  .strict();

export const revenueBreakdownSchema = z
  .object({ months: z.number().int().min(1).max(12).default(6) })
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

export const cancelLoyaltyBonusSchema = z
  .object({
    bonusId: z.string().cuid(),
    reason: withdrawalReasonSchema,
  })
  .strict();
