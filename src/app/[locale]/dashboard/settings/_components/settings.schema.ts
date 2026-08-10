import { z } from "zod";

import { passwordSchema } from "~/schemas/auth/password.schema";

/**
 * The router input schemas (F6-10) stay the single source of truth and are
 * re-exported for the forms that submit them unchanged.
 */
export {
  updateBusinessProfileSchema,
  updateOwnerSchema,
  type ChangePasswordInput,
  type UpdateBusinessProfileInput,
  type UpdateOwnerInput,
} from "~/schemas/settings/business-settings.schema";

/**
 * Client-only schema: `confirmPassword` never reaches the router, it exists to
 * catch a typo before the session is invalidated. `passwordSchema` is the same
 * rule the server applies to `newPassword`.
 */
export const changePasswordFormSchema = z
  .object({
    currentPassword: z.string().min(1),
    newPassword: passwordSchema,
    confirmPassword: z.string().min(1),
  })
  .strict()
  .refine((input) => input.newPassword !== input.currentPassword, {
    path: ["newPassword"],
    message: "The new password must differ from the current one",
  })
  .refine((input) => input.newPassword === input.confirmPassword, {
    path: ["confirmPassword"],
    message: "The confirmation must match the new password",
  });

export type ChangePasswordFormInput = z.infer<typeof changePasswordFormSchema>;
