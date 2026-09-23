import { z } from "zod";

import { passwordSchema } from "~/schemas/auth/password.schema";

/**
 * Client-only schema: `confirmPassword` never reaches the router; it catches
 * a typo before every session is revoked. `newPassword` follows the same
 * rule the server applies (`changePasswordSchema`).
 */
export const corporatePasswordFormSchema = z
  .object({
    currentPassword: z.string().min(1),
    newPassword: passwordSchema,
    confirmPassword: z.string().min(1),
  })
  .refine((input) => input.newPassword !== input.currentPassword, {
    path: ["newPassword"],
    message: "The new password must differ from the current one",
  })
  .refine((input) => input.newPassword === input.confirmPassword, {
    path: ["confirmPassword"],
    message: "The confirmation must match the new password",
  });
