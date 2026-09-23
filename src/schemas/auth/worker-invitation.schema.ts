import { z } from "zod";

import { passwordSchema } from "~/schemas/auth/password.schema";

/** Opaque base64url token from the invitation email. */
export const invitationTokenSchema = z.string().trim().min(20).max(200);

export const workerInvitationLookupSchema = z.object({
  token: invitationTokenSchema,
});

export const acceptWorkerInvitationSchema = z
  .object({
    token: invitationTokenSchema,
    name: z.string().trim().min(2).max(100),
    password: passwordSchema,
    confirmPassword: z.string(),
    locale: z.enum(["es", "en"]).default("es"),
  })
  .refine((input) => input.password === input.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match",
  });

export type AcceptWorkerInvitationInput = z.infer<
  typeof acceptWorkerInvitationSchema
>;
