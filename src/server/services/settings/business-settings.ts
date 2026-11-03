import "server-only";

import type {
  BusinessType,
  GuaranteeType,
  PrismaClient,
} from "@generated/prisma";
import type {
  ChangePasswordInput,
  SettingsErrorCode,
  UpdateBusinessContactInput,
  UpdateBusinessLogoInput,
  UpdateBusinessProfileInput,
  UpdateOwnerInput,
} from "~/schemas/settings/business-settings.schema";
import { fail, ok, type TrpcResponse } from "~/server/api/contract";
import { hashPassword, verifyPassword } from "~/server/services/auth/password";
import {
  isOwnPublicImage,
  nullablePublicImageUrl,
} from "~/server/services/media/public-image";

export type BusinessSettings = {
  business: {
    name: string;
    type: BusinessType;
    guaranteeType: GuaranteeType;
    guaranteeNotes: string | null;
    description: string | null;
    logoUrl: string | null;
    phone: string | null;
    whatsapp: string | null;
    contactEmail: string | null;
    website: string | null;
  };
  owner: { name: string | null; email: string | null };
};

export async function getSettings(
  db: PrismaClient,
  businessId: string,
): Promise<TrpcResponse<BusinessSettings>> {
  const business = await db.business.findUniqueOrThrow({
    where: { id: businessId },
    select: {
      name: true,
      type: true,
      guaranteeType: true,
      guaranteeNotes: true,
      description: true,
      logoPathname: true,
      phone: true,
      whatsapp: true,
      contactEmail: true,
      website: true,
      owner: { select: { name: true, email: true } },
    },
  });

  return ok(
    {
      business: {
        name: business.name,
        type: business.type,
        guaranteeType: business.guaranteeType,
        guaranteeNotes: business.guaranteeNotes,
        description: business.description,
        logoUrl: nullablePublicImageUrl(business.logoPathname),
        phone: business.phone,
        whatsapp: business.whatsapp,
        contactEmail: business.contactEmail,
        website: business.website,
      },
      owner: business.owner,
    },
    "Settings loaded",
  );
}

/**
 * `guaranteeType` is never part of `data`: changing it requires admin
 * re-approval and stays out of this API.
 */
export async function updateBusinessProfile(
  db: PrismaClient,
  businessId: string,
  input: UpdateBusinessProfileInput,
): Promise<TrpcResponse<{ id: string }>> {
  const business = await db.business.update({
    where: { id: businessId },
    data: {
      name: input.businessName,
      type: input.businessType,
      guaranteeNotes: input.guaranteeNotes ?? null,
    },
    select: { id: true },
  });

  return ok(business, "Business profile updated");
}

/** Public contact card: only the fields present in `input` are written. */
export async function updateBusinessContact(
  db: PrismaClient,
  businessId: string,
  input: UpdateBusinessContactInput,
): Promise<TrpcResponse<{ id: string }>> {
  const business = await db.business.update({
    where: { id: businessId },
    data: {
      ...(input.description !== undefined
        ? { description: input.description }
        : {}),
      ...(input.phone !== undefined ? { phone: input.phone } : {}),
      ...(input.whatsapp !== undefined ? { whatsapp: input.whatsapp } : {}),
      ...(input.contactEmail !== undefined
        ? { contactEmail: input.contactEmail }
        : {}),
      ...(input.website !== undefined ? { website: input.website } : {}),
    },
    select: { id: true },
  });

  return ok(business, "Business contact updated");
}

/** Sets or clears the logo; only the owner's own uploaded logos are accepted. */
export async function updateBusinessLogo(
  db: PrismaClient,
  input: UpdateBusinessLogoInput & { businessId: string; ownerId: string },
): Promise<TrpcResponse<{ id: string; logoUrl: string | null }>> {
  if (
    input.logoPathname !== null &&
    !isOwnPublicImage("logo", input.ownerId, input.logoPathname)
  ) {
    return fail("VALIDATION_ERROR", 422, "Logo must be uploaded first");
  }

  const business = await db.business.update({
    where: { id: input.businessId },
    data: { logoPathname: input.logoPathname },
    select: { id: true, logoPathname: true },
  });

  return ok(
    { id: business.id, logoUrl: nullablePublicImageUrl(business.logoPathname) },
    input.logoPathname ? "Business logo updated" : "Business logo removed",
  );
}

export async function updateOwner(
  db: PrismaClient,
  ownerId: string,
  input: UpdateOwnerInput,
): Promise<TrpcResponse<{ id: string }>> {
  const owner = await db.user.update({
    where: { id: ownerId },
    data: { name: input.ownerName },
    select: { id: true },
  });

  return ok(owner, "Owner updated");
}

/**
 * Verifies the current password and rotates `sessionsValidFrom` so the JWT
 * callback invalidates every previously issued token. Passwords and hashes are
 * never logged.
 */
export async function changePassword(
  db: PrismaClient,
  ownerId: string,
  input: ChangePasswordInput,
): Promise<TrpcResponse<null, SettingsErrorCode>> {
  const user = await db.user.findUniqueOrThrow({
    where: { id: ownerId },
    select: { passwordHash: true },
  });
  // A missing hash (OAuth-only account) and a wrong password share one code so
  // the response never reveals which one happened.
  const isCurrentPasswordValid =
    user.passwordHash !== null &&
    (await verifyPassword(input.currentPassword, user.passwordHash));

  if (!isCurrentPasswordValid) {
    return fail(
      "CURRENT_PASSWORD_INVALID",
      400,
      "current password check failed",
    );
  }

  await db.user.update({
    where: { id: ownerId },
    data: {
      passwordHash: await hashPassword(input.newPassword),
      sessionsValidFrom: new Date(),
    },
    select: { id: true },
  });

  return ok(null, "password updated", 204);
}
