import { z } from "zod";

import { passwordSchema } from "~/schemas/auth/password.schema";

/**
 * The router schemas stay the single source of truth; the forms below add the
 * client-only confirmation field that never reaches the server.
 */
export {
  updateAssistantPreferencesSchema,
  updateIdentitySchema,
} from "~/schemas/profile/profile.schema";

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

/** Google-only accounts create their first password: no current one to check. */
export const createPasswordFormSchema = z
  .object({
    newPassword: passwordSchema,
    confirmPassword: z.string().min(1),
  })
  .strict()
  .refine((input) => input.newPassword === input.confirmPassword, {
    path: ["confirmPassword"],
    message: "The confirmation must match the new password",
  });

export type PasswordFieldKey =
  "currentPassword" | "newPassword" | "confirmPassword";

export function isPasswordFieldKey(key: PropertyKey): key is PasswordFieldKey {
  return (
    key === "currentPassword" ||
    key === "newPassword" ||
    key === "confirmPassword"
  );
}
