import "server-only";

import type { PrismaClient } from "@generated/prisma";
import type {
  SetPasswordInput,
  UpdateAssistantPreferencesInput,
  UpdateIdentityInput,
} from "~/schemas/profile/profile.schema";
import { hashPassword, verifyPassword } from "~/server/services/auth/password";
import {
  svcFail,
  svcOk,
  type ServiceResult,
} from "~/server/services/service-result";

export async function updateIdentity(
  db: PrismaClient,
  userId: string,
  input: UpdateIdentityInput,
): Promise<void> {
  await db.user.update({
    where: { id: userId },
    data: { name: input.name, locale: input.locale },
    select: { id: true },
  });
}

export async function updateAssistantPreferences(
  db: PrismaClient,
  userId: string,
  input: UpdateAssistantPreferencesInput,
): Promise<void> {
  await db.user.update({
    where: { id: userId },
    data: { agentDefaultModel: input.agentDefaultModel },
    select: { id: true },
  });
}

export type SetPasswordErrorCode =
  | "CURRENT_PASSWORD_INVALID"
  | "PASSWORD_ALREADY_SET";

/**
 * Change or create the local password. An account without a hash (Google
 * sign-in) creates one with `currentPassword: null`; an account with a hash
 * must present the current one. Both paths rotate `sessionsValidFrom`, so
 * every other session ends and the caller signs out.
 */
export async function setPassword(
  db: PrismaClient,
  userId: string,
  input: SetPasswordInput,
): Promise<ServiceResult<null, SetPasswordErrorCode>> {
  const user = await db.user.findUniqueOrThrow({
    where: { id: userId },
    select: { passwordHash: true },
  });

  if (user.passwordHash === null) {
    if (input.currentPassword !== null) {
      // Same code as a wrong password: the response never reveals whether a
      // local password exists.
      return svcFail("CURRENT_PASSWORD_INVALID");
    }
  } else {
    if (input.currentPassword === null) {
      return svcFail("PASSWORD_ALREADY_SET");
    }

    const valid = await verifyPassword(input.currentPassword, user.passwordHash);

    if (!valid) {
      return svcFail("CURRENT_PASSWORD_INVALID");
    }
  }

  await db.user.update({
    where: { id: userId },
    data: {
      passwordHash: await hashPassword(input.newPassword),
      sessionsValidFrom: new Date(),
    },
    select: { id: true },
  });

  return svcOk(null);
}

/** Ends every session of the user (web and mobile Bearer tokens). */
export async function signOutEverywhere(
  db: PrismaClient,
  userId: string,
): Promise<void> {
  await db.user.update({
    where: { id: userId },
    data: { sessionsValidFrom: new Date() },
    select: { id: true },
  });
}

/** Unlinks a mobile device; the filter carries the owner, not the caller. */
export async function removeDevice(
  db: PrismaClient,
  userId: string,
  deviceId: string,
): Promise<ServiceResult<null, "DEVICE_NOT_FOUND">> {
  const deleted = await db.pushToken.deleteMany({
    where: { id: deviceId, userId },
  });

  return deleted.count === 0 ? svcFail("DEVICE_NOT_FOUND") : svcOk(null);
}
