import { z } from "zod";

import { AGENT_MODELS } from "~/lib/agent/agent-models";
import { routing } from "~/i18n/routing";
import { passwordSchema } from "~/schemas/auth/password.schema";

/**
 * Router input schemas of the profile (F9-01), shared with the forms that
 * submit them unchanged. Client-only refinements (confirm password) live in
 * `src/components/profile/profile.form-schema.ts`.
 */
export const updateIdentitySchema = z
  .object({
    name: z.string().trim().min(2).max(80),
    locale: z.enum(routing.locales),
  })
  .strict();

const agentModelIds = AGENT_MODELS.map((model) => model.id) as [
  (typeof AGENT_MODELS)[number]["id"],
  ...(typeof AGENT_MODELS)[number]["id"][],
];

export const updateAssistantPreferencesSchema = z
  .object({
    agentDefaultModel: z.enum(agentModelIds),
  })
  .strict();

/** Change (has password) or create (Google-only account) in one procedure. */
export const setPasswordSchema = z
  .object({
    currentPassword: z.string().min(1).nullable(),
    newPassword: passwordSchema,
  })
  .strict()
  .refine((input) => input.currentPassword !== input.newPassword, {
    path: ["newPassword"],
    message: "The new password must differ from the current one",
  });

export const removeDeviceSchema = z
  .object({
    deviceId: z.string().cuid(),
  })
  .strict();

export type UpdateIdentityInput = z.infer<typeof updateIdentitySchema>;
export type UpdateAssistantPreferencesInput = z.infer<
  typeof updateAssistantPreferencesSchema
>;
export type SetPasswordInput = z.infer<typeof setPasswordSchema>;
export type RemoveDeviceInput = z.infer<typeof removeDeviceSchema>;
