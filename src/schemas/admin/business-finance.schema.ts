import { z } from "zod";

import { PaymentMethod, PaymentStatus } from "@generated/prisma";

import { infiniteQueryDirectionSchema } from "~/schemas/pagination.schema";
import { recordIdSchema } from "~/schemas/record-id.schema";

/** "YYYY-MM" in the platform's financial time zone; defaults to this month. */
const monthSchema = z.string().regex(/^\d{4}-\d{2}$/u);

export const getBusinessFinanceSchema = z
  .object({
    businessId: recordIdSchema,
    month: monthSchema.optional(),
  })
  .strict();

export const getWithdrawalSchema = z
  .object({ withdrawalId: recordIdSchema })
  .strict();

export const adminListBusinessTransactionsSchema = z
  .object({
    businessId: recordIdSchema,
    status: z.nativeEnum(PaymentStatus).optional(),
    method: z.nativeEnum(PaymentMethod).optional(),
    cursor: recordIdSchema.optional(),
    direction: infiniteQueryDirectionSchema,
  })
  .strict();
