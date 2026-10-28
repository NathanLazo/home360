import "server-only";

import type { Address, PrismaClient } from "@generated/prisma";
import { isWithinMexico } from "../geo/coverage";
import type { GeoPoint } from "../geo/haversine";
import { isGeoConfigured, reverseGeocode } from "../geo/places";
import { svcFail, svcOk, type ServiceResult } from "../service-result";

/** Hard cap per user; the mobile picker is not paginated. */
export const MAX_ADDRESSES_PER_USER = 10;

export type CreateAddressInput = {
  label: string;
  addressLine: string;
  neighborhood?: string;
  latitude: number;
  longitude: number;
  /** Google Places id when picked from `geo.suggest`/`geo.resolve` (§3). */
  placeId?: string;
  isDefault?: boolean;
};

export type UpdateAddressInput = {
  id: string;
  label?: string;
  addressLine?: string;
  neighborhood?: string;
  latitude?: number;
  longitude?: number;
  placeId?: string;
};

type CoverageError = "LOCATION_OUT_OF_COVERAGE";

type CreateAddressError = "ADDRESS_LIMIT_REACHED" | CoverageError;

/**
 * Best-effort colonia (§3): reverse-geocodes the point when the geo provider
 * is configured. Any failure yields null — it never blocks the save.
 */
async function inferNeighborhood(point: GeoPoint): Promise<string | null> {
  if (!isGeoConfigured()) {
    return null;
  }

  try {
    const place = await reverseGeocode({ ...point, locale: "es" });
    return place.ok ? place.data.neighborhood : null;
  } catch (error) {
    console.error("[address] neighborhood lookup failed", error);
    return null;
  }
}

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
  const point = { latitude: input.latitude, longitude: input.longitude };

  if (!isWithinMexico(point)) {
    return svcFail("LOCATION_OUT_OF_COVERAGE", "Address outside Mexico");
  }

  // Network lookup stays outside the transaction.
  const neighborhood = input.neighborhood ?? (await inferNeighborhood(point));

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
        neighborhood,
        latitude: input.latitude,
        longitude: input.longitude,
        placeId: input.placeId ?? null,
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
): Promise<ServiceResult<Address, CoverageError>> {
  const existing = await db.address.findFirst({
    where: { id: input.id, userId },
    select: { id: true, latitude: true, longitude: true, neighborhood: true },
  });

  if (!existing) {
    return svcFail("NOT_FOUND", "Address not found");
  }

  const point = {
    latitude: input.latitude ?? existing.latitude,
    longitude: input.longitude ?? existing.longitude,
  };
  const moved = input.latitude !== undefined || input.longitude !== undefined;

  if (moved && !isWithinMexico(point)) {
    return svcFail("LOCATION_OUT_OF_COVERAGE", "Address outside Mexico");
  }

  // A moved pin without a colonia (sent or stored) gets one best-effort.
  const inferredNeighborhood =
    moved && input.neighborhood === undefined && existing.neighborhood === null
      ? await inferNeighborhood(point)
      : null;

  const address = await db.address.update({
    where: { id: existing.id },
    data: {
      ...(input.label !== undefined ? { label: input.label } : {}),
      ...(input.addressLine !== undefined
        ? { addressLine: input.addressLine }
        : {}),
      ...(input.neighborhood !== undefined
        ? { neighborhood: input.neighborhood }
        : inferredNeighborhood !== null
          ? { neighborhood: inferredNeighborhood }
          : {}),
      ...(input.placeId !== undefined ? { placeId: input.placeId } : {}),
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
