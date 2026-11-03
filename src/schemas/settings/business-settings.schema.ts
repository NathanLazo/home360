import { z } from "zod";

import { BusinessType } from "@generated/prisma";
import { passwordSchema } from "~/schemas/auth/password.schema";
import type { ErrorCode } from "~/server/api/contract";

/**
 * Module error codes (F0 §4). `CURRENT_PASSWORD_INVALID` covers both a wrong
 * password and an account without a local hash, without telling them apart.
 */
export const SETTINGS_ERROR_CODES = ["CURRENT_PASSWORD_INVALID"] as const;

export type SettingsErrorCode =
  ErrorCode | (typeof SETTINGS_ERROR_CODES)[number];

/**
 * `guaranteeType` is deliberately absent: changing it requires admin
 * re-approval, so `.strict()` rejects it instead of silently ignoring it.
 */
export const updateBusinessProfileSchema = z
  .object({
    businessName: z.string().trim().min(2).max(100),
    businessType: z.nativeEnum(BusinessType),
    guaranteeNotes: z.string().trim().max(500).nullish(),
  })
  .strict();

const optionalText = (max: number) =>
  z.string().trim().min(1).max(max).nullable().optional();

/**
 * Public contact card of the business. `undefined` keeps a field, `null`
 * clears it. Phones are stored normalized as typed (digits, +, spaces, dashes).
 */
const phoneSchema = z
  .string()
  .trim()
  .regex(/^\+?[0-9 ()-]{7,20}$/u)
  .nullable()
  .optional();

export const updateBusinessContactSchema = z
  .object({
    description: optionalText(1_000),
    phone: phoneSchema,
    whatsapp: phoneSchema,
    contactEmail: z.string().trim().email().max(200).nullable().optional(),
    website: z
      .string()
      .trim()
      .url()
      .max(300)
      .refine(
        (value) => value.startsWith("https://") || value.startsWith("http://"),
      )
      .nullable()
      .optional(),
  })
  .strict();

/** Logo pathname from `media.uploadPublicImage` (scope "logo"), or `null`. */
export const updateBusinessLogoSchema = z
  .object({
    logoPathname: z.string().trim().min(1).max(200).nullable(),
  })
  .strict();

export const updateOwnerSchema = z
  .object({
    ownerName: z.string().trim().min(2).max(100),
  })
  .strict();

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1),
    newPassword: passwordSchema,
  })
  .strict()
  .refine((input) => input.currentPassword !== input.newPassword, {
    path: ["newPassword"],
    message: "The new password must differ from the current one",
  });

export type UpdateBusinessProfileInput = z.infer<
  typeof updateBusinessProfileSchema
>;
export type UpdateBusinessContactInput = z.infer<
  typeof updateBusinessContactSchema
>;
export type UpdateBusinessLogoInput = z.infer<typeof updateBusinessLogoSchema>;
export type UpdateOwnerInput = z.infer<typeof updateOwnerSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
