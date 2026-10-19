import "server-only";

import { BranchStatus, type Prisma } from "@generated/prisma";
import { haversineKm, type GeoPoint } from "~/server/services/geo/haversine";

/**
 * Per-branch stock of a product as the marketplace and checkout see it
 * (D10-4 / D10-6): `stock` is the *available* quantity (reservations are
 * already taken out) and only ACTIVE branches count.
 */
export const productBranchStockSelect = {
  productId: true,
  stock: true,
  lowStockThreshold: true,
  branch: {
    select: {
      id: true,
      name: true,
      address: true,
      latitude: true,
      longitude: true,
      pickupEnabled: true,
      deliveryEnabled: true,
      status: true,
    },
  },
} satisfies Prisma.ProductStockSelect;

export type ProductBranchStockRow = Prisma.ProductStockGetPayload<{
  select: typeof productBranchStockSelect;
}>;

/** Where-filter for stock rows a customer can actually buy from. */
export const sellableStockWhere = {
  branch: { status: BranchStatus.ACTIVE },
} satisfies Prisma.ProductStockWhereInput;

export type PickupBranchOption = {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  distanceKm: number | null;
  /** Units available at this branch. */
  available: number;
};

export type ProductAvailability = {
  /** Max available units at a single eligible branch (never the raw sum). */
  available: number;
  /** `available` is at or below that branch's low-stock threshold. */
  lowStock: boolean;
  fulfillment: {
    /** Some ACTIVE delivery-enabled branch has stock. */
    delivery: boolean;
    /** ACTIVE pickup-enabled, geocoded branches with stock, nearest first. */
    pickupBranches: PickupBranchOption[];
  };
};

function branchPoint(row: ProductBranchStockRow): GeoPoint | null {
  return row.branch.latitude !== null && row.branch.longitude !== null
    ? { latitude: row.branch.latitude, longitude: row.branch.longitude }
    : null;
}

export function distanceFrom(
  origin: GeoPoint | null,
  point: GeoPoint | null,
): number | null {
  return origin !== null && point !== null ? haversineKm(origin, point) : null;
}

function isActive(row: ProductBranchStockRow): boolean {
  return row.branch.status === BranchStatus.ACTIVE;
}

function canDeliver(row: ProductBranchStockRow): boolean {
  return isActive(row) && row.branch.deliveryEnabled;
}

function canPickup(row: ProductBranchStockRow): boolean {
  return isActive(row) && row.branch.pickupEnabled && branchPoint(row) !== null;
}

/** Availability summary of one product over its stock rows (D10-6). */
export function summarizeAvailability(
  rows: readonly ProductBranchStockRow[],
  origin: GeoPoint | null,
): ProductAvailability {
  const eligible = rows.filter(
    (row) => row.stock > 0 && (canDeliver(row) || canPickup(row)),
  );
  const best = eligible.reduce<ProductBranchStockRow | null>(
    (current, row) =>
      current === null || row.stock > current.stock ? row : current,
    null,
  );
  const available = best?.stock ?? 0;
  const pickupBranches = eligible
    .filter(canPickup)
    .flatMap((row) => {
      const point = branchPoint(row);

      return point === null
        ? []
        : [
            {
              id: row.branch.id,
              name: row.branch.name,
              address: row.branch.address,
              latitude: point.latitude,
              longitude: point.longitude,
              distanceKm: distanceFrom(origin, point),
              available: row.stock,
            },
          ];
    })
    .sort(
      (a, b) =>
        (a.distanceKm ?? Number.POSITIVE_INFINITY) -
          (b.distanceKm ?? Number.POSITIVE_INFINITY) ||
        a.name.localeCompare(b.name),
    );

  return {
    available,
    lowStock: best !== null && best.stock <= best.lowStockThreshold,
    fulfillment: {
      delivery: eligible.some(canDeliver),
      pickupBranches,
    },
  };
}

export type BranchSelection =
  | { ok: true; branchId: string }
  | { ok: false; code: "DELIVERY_NOT_AVAILABLE" | "OUT_OF_STOCK" };

export type DeliveryBranchRanking =
  | { ok: true; branchIds: string[] }
  | { ok: false; code: "DELIVERY_NOT_AVAILABLE" | "OUT_OF_STOCK" };

/**
 * D10-6 DELIVERY candidates: the ACTIVE delivery-enabled branches with
 * enough available units, nearest to the address first (geo-less branches
 * rank last, ties by most stock). Checkout re-ranks inside its transaction
 * and falls through to the next candidate when a reservation loses the race
 * for the last units (F10 review L8).
 */
export function rankDeliveryBranches(
  rows: readonly ProductBranchStockRow[],
  quantity: number,
  destination: GeoPoint,
): DeliveryBranchRanking {
  const deliverable = rows.filter(canDeliver);

  if (deliverable.length === 0) {
    return { ok: false, code: "DELIVERY_NOT_AVAILABLE" };
  }

  const branchIds = deliverable
    .filter((row) => row.stock >= quantity)
    .map((row) => ({
      row,
      distanceKm: distanceFrom(destination, branchPoint(row)),
    }))
    .sort(
      (a, b) =>
        (a.distanceKm ?? Number.POSITIVE_INFINITY) -
          (b.distanceKm ?? Number.POSITIVE_INFINITY) ||
        b.row.stock - a.row.stock,
    )
    .map(({ row }) => row.branch.id);

  return branchIds.length > 0
    ? { ok: true, branchIds }
    : { ok: false, code: "OUT_OF_STOCK" };
}

/** D10-6 PICKUP branch: the one the customer chose, validated. */
export function validatePickupBranch(
  rows: readonly ProductBranchStockRow[],
  branchId: string,
  quantity: number,
): BranchSelection | { ok: false; code: "PICKUP_NOT_AVAILABLE" } {
  const row = rows.find((candidate) => candidate.branch.id === branchId);

  if (!row || !canPickup(row)) {
    return { ok: false, code: "PICKUP_NOT_AVAILABLE" };
  }

  return row.stock >= quantity
    ? { ok: true, branchId: row.branch.id }
    : { ok: false, code: "OUT_OF_STOCK" };
}
