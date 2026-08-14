import "server-only";

import type { Address, PrismaClient } from "../../../../generated/prisma";
import { svcFail, svcOk, type ServiceResult } from "../service-result";

/** Hard cap per user; the mobile picker is not paginated. */
export const MAX_ADDRESSES_PER_USER = 10;

export type CreateAddressInput = {
  label: string;
  addressLine: string;
  latitude: number;
  longitude: number;
  isDefault?: boolean;
};

export type UpdateAddressInput = {
  id: string;
  label?: string;
  addressLine?: string;
  latitude?: number;
  longitude?: number;
};

type CreateAddressError = "ADDRESS_LIMIT_REACHED";

/** Default first, then newest — the order the picker renders. */
export async function listAddresses(
  db: PrismaClient,
  userId: string,
): Promise<ServiceResult<Address[]>> {
  const addresses = await db.address.findMany({
    where: { userId },
    orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
  });

  return svcOk(addresses);
}

/**
 * The first address becomes the default automatically; an explicit
 * `isDefault: true` demotes the current one. Count check and demotion run in
 * one transaction so the single-default invariant holds under concurrency.
 */
export async function createAddress(
  db: PrismaClient,
  userId: string,
  input: CreateAddressInput,
): Promise<ServiceResult<Address, CreateAddressError>> {
  return db.$transaction(async (tx) => {
    const count = await tx.address.count({ where: { userId } });

    if (count >= MAX_ADDRESSES_PER_USER) {
      return svcFail("ADDRESS_LIMIT_REACHED", "Address limit reached");
    }

    const isDefault = input.isDefault === true || count === 0;

    if (isDefault) {
      await tx.address.updateMany({
        where: { userId, isDefault: true },
        data: { isDefault: false },
      });
    }

    const address = await tx.address.create({
      data: {
        userId,
        label: input.label,
        addressLine: input.addressLine,
        latitude: input.latitude,
        longitude: input.longitude,
        isDefault,
      },
    });

    return svcOk(address);
  });
}

/**
 * Editable fields only; the default flag moves exclusively through
 * `setDefaultAddress`. A foreign id answers a generic NOT_FOUND.
 */
export async function updateAddress(
  db: PrismaClient,
  userId: string,
  input: UpdateAddressInput,
): Promise<ServiceResult<Address>> {
  const existing = await db.address.findFirst({
    where: { id: input.id, userId },
    select: { id: true },
  });

  if (!existing) {
    return svcFail("NOT_FOUND", "Address not found");
  }

  const address = await db.address.update({
    where: { id: existing.id },
    data: {
      ...(input.label !== undefined ? { label: input.label } : {}),
      ...(input.addressLine !== undefined
        ? { addressLine: input.addressLine }
        : {}),
      ...(input.latitude !== undefined ? { latitude: input.latitude } : {}),
      ...(input.longitude !== undefined ? { longitude: input.longitude } : {}),
    },
  });

  return svcOk(address);
}

/**
 * Deleting the default promotes the newest remaining address so the "default
 * exists while any address exists" invariant survives (mirrors create).
 */
export async function deleteAddress(
  db: PrismaClient,
  userId: string,
  addressId: string,
): Promise<ServiceResult<{ id: string }>> {
  return db.$transaction(async (tx) => {
    const existing = await tx.address.findFirst({
      where: { id: addressId, userId },
      select: { id: true, isDefault: true },
    });

    if (!existing) {
      return svcFail("NOT_FOUND", "Address not found");
    }

    await tx.address.delete({ where: { id: existing.id } });

    if (existing.isDefault) {
      const successor = await tx.address.findFirst({
        where: { userId },
        orderBy: { createdAt: "desc" },
        select: { id: true },
      });

      if (successor) {
        await tx.address.update({
          where: { id: successor.id },
          data: { isDefault: true },
        });
      }
    }

    return svcOk({ id: existing.id });
  });
}

/** Demote-then-promote in one transaction: at most one default per user. */
export async function setDefaultAddress(
  db: PrismaClient,
  userId: string,
  addressId: string,
): Promise<ServiceResult<Address>> {
  return db.$transaction(async (tx) => {
    const existing = await tx.address.findFirst({
      where: { id: addressId, userId },
      select: { id: true },
    });

    if (!existing) {
      return svcFail("NOT_FOUND", "Address not found");
    }

    await tx.address.updateMany({
      where: { userId, isDefault: true, id: { not: existing.id } },
      data: { isDefault: false },
    });
    const address = await tx.address.update({
      where: { id: existing.id },
      data: { isDefault: true },
    });

    return svcOk(address);
  });
}
