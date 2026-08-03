import { z } from "zod";

import { passwordSchema } from "./password.schema";

export const requestPasswordResetSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  locale: z.enum(["es", "en"]),
});

export const resetPasswordTransportSchema = z.object({
  token: z.string(),
  password: z.string(),
  confirmPassword: z.string(),
});

export const resetPasswordSchema = z
  .object({
    token: z.string().trim().min(1),
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine(({ password, confirmPassword }) => password === confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match",
  });

export type RequestPasswordResetInput = z.infer<
  typeof requestPasswordResetSchema
>;

export type ResetPasswordTransportInput = z.infer<
  typeof resetPasswordTransportSchema
>;
