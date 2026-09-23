import "server-only";

import { Prisma, type PrismaClient } from "@generated/prisma";

import type {
  CorporateLocationCreateInput,
  CorporateLocationUpdateInput,
} from "~/server/api/schemas/corporate";
import { fail, ok, type TrpcResponse } from "~/server/api/contract";
import { ACTIVE_ORDER_STATUSES } from "~/server/services/business/order-activity";

const MAX_SERIALIZABLE_ATTEMPTS = 3;

const locationListSelect = {
  id: true,
  name: true,
  addressLine: true,
  city: true,
  contactName: true,
  contactPhone: true,
  isActive: true,
  createdAt: true,
  _count: { select: { orders: true } },
} satisfies Prisma.CorporateLocationSelect;

type LocationListPayload = Prisma.CorporateLocationGetPayload<{
  select: typeof locationListSelect;
}>;

export type CorporateLocationItem = {
  id: string;
  name: string;
  addressLine: string;
  city: string;
  contactName: string | null;
  contactPhone: string | null;
  isActive: boolean;
  createdAt: Date;
  ordersCount: number;
};

export type CorporateLocationListResult = {
  items: CorporateLocationItem[];
  limits: { used: number; max: number | null };
};

/**
 * Account context resolved by `corporateProcedure` from the session; the
 * tenant id never comes from client input.
 */
export type CorporateAccountContext = {
  id: string;
  maxLocations: number | null;
};

function toLocationItem(location: LocationListPayload): CorporateLocationItem {
  return {
    id: location.id,
    name: location.name,
    addressLine: location.addressLine,
    city: location.city,
    contactName: location.contactName,
    contactPhone: location.contactPhone,
    isActive: location.isActive,
    createdAt: location.createdAt,
    ordersCount: location._count.orders,
  };
}

function isRecordNotFound(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2025"
  );
}

function isSerializableConflict(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2034"
  );
}

export async function listCorporateLocations(
  db: PrismaClient,
  account: CorporateAccountContext,
  input: { includeInactive?: boolean },
): Promise<TrpcResponse<CorporateLocationListResult>> {
  const [locations, activeCount] = await Promise.all([
    db.corporateLocation.findMany({
      where: {
        corporateAccountId: account.id,
        ...(input.includeInactive ? {} : { isActive: true }),
      },
      select: locationListSelect,
      orderBy: [{ name: "asc" }, { id: "asc" }],
    }),
    db.corporateLocation.count({
      where: { corporateAccountId: account.id, isActive: true },
    }),
  ]);

  return ok(
    {
      items: locations.map(toLocationItem),
      // Only active locations count against `maxLocations`: deactivated ones
      // keep their history without occupying a paid slot.
      limits: { used: activeCount, max: account.maxLocations },
    },
    "Corporate locations loaded",
  );
}

/**
 * Creates a location inside a serializable transaction so two concurrent
 * requests can never exceed `maxLocations` (same F4 contract:
 * `PLAN_LIMIT_REACHED` when the tier limit is hit). `maxLocations: null`
 * means unlimited.
 */
export async function createCorporateLocation(
  db: PrismaClient,
  account: CorporateAccountContext,
  input: CorporateLocationCreateInput,
): Promise<TrpcResponse<{ id: string }>> {
  for (
    let transactionAttempt = 0;
    transactionAttempt < MAX_SERIALIZABLE_ATTEMPTS;
    transactionAttempt += 1
  ) {
    try {
      return await db.$transaction(
        async (tx) => {
          if (account.maxLocations !== null) {
            const used = await tx.corporateLocation.count({
              where: { corporateAccountId: account.id, isActive: true },
            });

            if (used >= account.maxLocations) {
              return fail(
                "PLAN_LIMIT_REACHED",
                409,
                "Corporate tier limit reached for locations",
              );
            }
          }

          const location = await tx.corporateLocation.create({
            data: {
              corporateAccountId: account.id,
              name: input.name,
              addressLine: input.addressLine,
              city: input.city,
              contactName: input.contactName,
              contactPhone: input.contactPhone,
            },
            select: { id: true },
          });

          return ok(location, "Corporate location created", 201);
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      if (!isSerializableConflict(error)) {
        throw error;
      }
    }
  }

  return fail("CONFLICT", 409, "Location creation conflicted; try again");
}

/**
 * Tenant filtering happens inside the `update` where (id + account id), so a
 * foreign and a missing location answer the same `NOT_FOUND`. `isActive` is
 * deliberately untouched: editing an inactive location never reactivates it.
 */
export async function updateCorporateLocation(
  db: PrismaClient,
  corporateAccountId: string,
  input: CorporateLocationUpdateInput,
): Promise<TrpcResponse<{ id: string }>> {
  try {
    const location = await db.corporateLocation.update({
      where: { id: input.locationId, corporateAccountId },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.addressLine !== undefined
          ? { addressLine: input.addressLine }
          : {}),
        ...(input.city !== undefined ? { city: input.city } : {}),
        ...(input.contactName !== undefined
          ? { contactName: input.contactName }
          : {}),
        ...(input.contactPhone !== undefined
          ? { contactPhone: input.contactPhone }
          : {}),
      },
      select: { id: true },
    });

    return ok(location, "Corporate location updated");
  } catch (error) {
    if (isRecordNotFound(error)) {
      return fail("NOT_FOUND", 404, "Corporate location not found");
    }

    throw error;
  }
}

/**
 * Deactivates, never deletes: historical orders keep their location. The
 * active-order check and the update share one transaction so an order created
 * in between cannot orphan an operating location.
 */
export async function deactivateCorporateLocation(
  db: PrismaClient,
  corporateAccountId: string,
  locationId: string,
): Promise<TrpcResponse<{ id: string }>> {
  return db.$transaction(async (tx) => {
    const activeOrders = await tx.order.count({
      where: {
        corporateAccountId,
        corporateLocationId: locationId,
        status: { in: [...ACTIVE_ORDER_STATUSES] },
      },
    });

    if (activeOrders > 0) {
      return fail("CONFLICT", 409, "Location has active orders");
    }

    try {
      const location = await tx.corporateLocation.update({
        where: { id: locationId, corporateAccountId },
        data: { isActive: false },
        select: { id: true },
      });

      return ok(location, "Corporate location deactivated");
    } catch (error) {
      if (isRecordNotFound(error)) {
        return fail("NOT_FOUND", 404, "Corporate location not found");
      }

      throw error;
    }
  });
}

/**
 * Reactivates an inactive location (workstream D). Same serializable limit
 * check as `createCorporateLocation`: a reactivation occupies a paid slot, so
 * it answers `PLAN_LIMIT_REACHED` when the tier is full.
 */
export async function reactivateCorporateLocation(
  db: PrismaClient,
  account: CorporateAccountContext,
  locationId: string,
): Promise<TrpcResponse<{ id: string }>> {
  for (
    let transactionAttempt = 0;
    transactionAttempt < MAX_SERIALIZABLE_ATTEMPTS;
    transactionAttempt += 1
  ) {
    try {
      return await db.$transaction(
        async (tx) => {
          const location = await tx.corporateLocation.findFirst({
            where: { id: locationId, corporateAccountId: account.id },
            select: { id: true, isActive: true },
          });

          if (!location) {
            return fail("NOT_FOUND", 404, "Corporate location not found");
          }

          if (location.isActive) {
            return ok({ id: location.id }, "Corporate location already active");
          }

          if (account.maxLocations !== null) {
            const used = await tx.corporateLocation.count({
              where: { corporateAccountId: account.id, isActive: true },
            });

            if (used >= account.maxLocations) {
              return fail(
                "PLAN_LIMIT_REACHED",
                409,
                "Corporate tier limit reached for locations",
              );
            }
          }

          await tx.corporateLocation.update({
            where: { id: location.id, corporateAccountId: account.id },
            data: { isActive: true },
            select: { id: true },
          });

          return ok({ id: location.id }, "Corporate location reactivated");
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      if (!isSerializableConflict(error)) {
        throw error;
      }
    }
  }

  return fail("CONFLICT", 409, "Location reactivation conflicted; try again");
}
