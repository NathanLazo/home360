import { z } from "zod";

import { BusinessType, GuaranteeType } from "../../../generated/prisma";
import { passwordSchema } from "./password.schema";

export const registerAccountStepSchema = z.object({
  ownerName: z.string().trim().min(2).max(100),
  email: z.string().trim().toLowerCase().email(),
  password: passwordSchema,
});

export const registerBusinessStepSchema = z.object({
  businessName: z.string().trim().min(2).max(100),
  businessType: z.nativeEnum(BusinessType),
});

export const registerGuaranteeStepSchema = z.object({
  guaranteeType: z.nativeEnum(GuaranteeType),
  guaranteeNotes: z.string().trim().max(500).optional(),
});

export const registerBusinessSchema = registerAccountStepSchema
  .merge(registerBusinessStepSchema)
  .merge(registerGuaranteeStepSchema);

export type RegisterBusinessInput = z.infer<typeof registerBusinessSchema>;
