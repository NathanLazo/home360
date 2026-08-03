import type { z } from "zod";

import {
  registerAccountStepSchema,
  registerBusinessSchema,
  registerBusinessStepSchema,
  registerGuaranteeStepSchema,
} from "~/schemas/auth/register-business.schema";

export {
  registerAccountStepSchema,
  registerBusinessSchema,
  registerBusinessStepSchema,
  registerGuaranteeStepSchema,
};

export type RegisterAccountStep = z.infer<typeof registerAccountStepSchema>;
export type RegisterBusinessStep = z.infer<typeof registerBusinessStepSchema>;
export type RegisterGuaranteeStep = z.infer<typeof registerGuaranteeStepSchema>;
