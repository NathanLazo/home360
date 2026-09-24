import { z } from "zod";

import { PaymentMethod, PaymentStatus } from "@generated/prisma";

import { infiniteQueryDirectionSchema } from "~/schemas/pagination.schema";

/** "YYYY-MM" in the platform's financial time zone; defaults to this month. */
const monthSchema = z.string().regex(/^\d{4}-\d{2}$/u);

export const getBusinessFinanceSchema = z
  .object({
    businessId: z.string().cuid(),
    month: monthSchema.optional(),
  })
  .strict();

export const getWithdrawalSchema = z
  .object({ withdrawalId: z.string().cuid() })
  .strict();

export const adminListBusinessTransactionsSchema = z
  .object({
    businessId: z.string().cuid(),
    status: z.nativeEnum(PaymentStatus).optional(),
    method: z.nativeEnum(PaymentMethod).optional(),
    cursor: z.string().cuid().optional(),
    direction: infiniteQueryDirectionSchema,
  })
  .strict();
