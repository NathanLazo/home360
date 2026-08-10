import "server-only";

import type {
  BusinessType,
  GuaranteeType,
  PrismaClient,
} from "../../../../generated/prisma";
import type {
  ChangePasswordInput,
  SettingsErrorCode,
  UpdateBusinessProfileInput,
  UpdateOwnerInput,
} from "~/schemas/settings/business-settings.schema";
import { fail, ok, type TrpcResponse } from "~/server/api/contract";
import { hashPassword, verifyPassword } from "~/server/services/auth/password";

export type BusinessSettings = {
  business: {
    name: string;
    type: BusinessType;
    guaranteeType: GuaranteeType;
    guaranteeNotes: string | null;
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
