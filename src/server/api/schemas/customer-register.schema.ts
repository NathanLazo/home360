import { z } from "zod";

import { passwordSchema } from "~/schemas/auth/password.schema";

/**
 * Shared Zod schema for the mobile customer registration (M1-W1). The router
 * validates with this and the app reuses the same input type through the
 * type-only `@home360/api` alias, so both sides agree on limits without a
 * parallel definition. Same field policies as
 * `~/schemas/auth/register-business.schema.ts`.
 */
export const customerRegisterSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().toLowerCase().email(),
  password: passwordSchema,
  /** UI locale the app registered with; persisted on `User.locale` (M3-W0). */
  locale: z.enum(["es", "en"]),
});

export type CustomerRegisterInput = z.infer<typeof customerRegisterSchema>;
