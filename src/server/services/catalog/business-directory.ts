import "server-only";

import {
  BranchStatus,
  ProductStatus,
  ServiceStatus,
  type BusinessType,
  type GuaranteeType,
  type Prisma,
  type PrismaClient,
} from "@generated/prisma";
import { fail, ok, type TrpcResponse } from "~/server/api/contract";
import {
  distanceFrom,
  productBranchStockSelect,
  summarizeAvailability,
} from "~/server/services/catalog/product-availability";
import { marketplaceBusinessWhere } from "~/server/services/catalog/marketplace-business";
import { approximateCoordinate } from "~/server/services/geo/approximate";
import type { GeoPoint } from "~/server/services/geo/haversine";

import type { MarketplaceKind } from "./marketplace";

const PAGE_SIZE = 20;
/**
 * Distance ranking happens in memory over the matching ACTIVE businesses
 * (launch city scale). The scan is capped so a broad query stays bounded.
 */
const MAX_DIRECTORY_SCAN = 500;

export type ListBusinessesInput = {
  cursor?: string;
  category?: string;
  kind?: MarketplaceKind;
  origin: GeoPoint | null;
};

export type MarketplaceBusinessListItem = {
  id: string;
  name: string;
  type: BusinessType;
  guaranteeType: GuaranteeType;
  ratingAvg: number | null;
  ratingCount: number;
  /** Nearest ACTIVE geocoded branch to the origin; null without either. */
  distanceKm: number | null;
  categories: string[];
  /** First published product image (businesses have no cover upload yet). */
  coverUrl: string | null;
  servicesCount: number;
  productsCount: number;
};

export type MarketplaceBusinessList = {
  items: MarketplaceBusinessListItem[];
  nextCursor: string | null;
};

export type MarketplaceBusinessProfile = {
  id: string;
  name: string;
  type: BusinessType;
  guaranteeType: GuaranteeType;
  guaranteeNotes: string | null;
  ratingAvg: number | null;
  ratingCount: number;
  /**
   * F10 review L5: only pickup counters are public places. A branch without
   * pickup (often a service business's home base) has no address and only
   * approximate coordinates (~110 m), so `exactLocation` is false.
   */
  branches: {
    id: string;
    name: string;
    address: string | null;
    latitude: number | null;
    longitude: number | null;
    pickupEnabled: boolean;
    exactLocation: boolean;
    distanceKm: number | null;
  }[];
  services: {
    id: string;
    name: string;
    category: string;
    basePriceCents: number;
    durationMinutes: number;
  }[];
  products: {
    id: string;
    name: string;
    category: string;
    priceCents: number;
    imageUrl: string | null;
    /** Max units at one eligible branch (D10-6). */
    available: number;
    lowStock: boolean;
  }[];
};

export type MarketplaceServiceDetail = {
  id: string;
  name: string;
  category: string;
  basePriceCents: number;
  durationMinutes: number;
  durationMaxMinutes: number | null;
  businessId: string;
  business: {
    id: string;
    name: string;
    ratingAvg: number | null;
    ratingCount: number;
    guaranteeType: GuaranteeType;
  };
};

/**
 * Origin of every marketplace distance: the explicit point when both
 * coordinates come in, else the customer's default (or newest) address.
 */
export async function resolveMarketplaceOrigin(
  db: PrismaClient,
  input: { customerId: string; lat?: number; lng?: number },
): Promise<GeoPoint | null> {
  if (input.lat !== undefined && input.lng !== undefined) {
    return { latitude: input.lat, longitude: input.lng };
  }

  const address = await db.address.findFirst({
    where: { userId: input.customerId },
    orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
    select: { latitude: true, longitude: true },
  });

  return address
    ? { latitude: address.latitude, longitude: address.longitude }
    : null;
}

function catalogWhere(
  input: Pick<ListBusinessesInput, "category" | "kind">,
): Prisma.BusinessWhereInput {
  const category = input.category ? { category: input.category } : {};
  const services: Prisma.BusinessWhereInput = {
    services: { some: { status: ServiceStatus.ACTIVE, ...category } },
  };
  const products: Prisma.BusinessWhereInput = {
    products: { some: { status: ProductStatus.PUBLISHED, ...category } },
  };

  if (input.kind === "service") {
    return services;
  }

  if (input.kind === "product") {
    return products;
  }

  return { OR: [services, products] };
}

function nearestDistance(
  origin: GeoPoint | null,
  branches: readonly { latitude: number | null; longitude: number | null }[],
): number | null {
  let nearest: number | null = null;

  for (const branch of branches) {
    const distance = distanceFrom(
      origin,
      branch.latitude !== null && branch.longitude !== null
        ? { latitude: branch.latitude, longitude: branch.longitude }
        : null,
    );

    if (distance !== null && (nearest === null || distance < nearest)) {
      nearest = distance;
    }
  }

  return nearest;
}

function compareBusinesses(
  a: MarketplaceBusinessListItem,
  b: MarketplaceBusinessListItem,
): number {
  return (
    (a.distanceKm ?? Number.POSITIVE_INFINITY) -
      (b.distanceKm ?? Number.POSITIVE_INFINITY) ||
    (b.ratingAvg ?? -1) - (a.ratingAvg ?? -1) ||
    b.ratingCount - a.ratingCount ||
    a.name.localeCompare(b.name) ||
    a.id.localeCompare(b.id)
  );
}

/**
 * D10-10 discovery: ACTIVE businesses with catalog (filtered by `kind` and
 * `category`), nearest first when an origin is known, then best rated.
 * Cursor = id of the last business of the previous page.
 */
export async function listMarketplaceBusinesses(
  db: PrismaClient,
  input: ListBusinessesInput,
): Promise<TrpcResponse<MarketplaceBusinessList>> {
  const rows = await db.business.findMany({
    where: { ...marketplaceBusinessWhere, ...catalogWhere(input) },
    take: MAX_DIRECTORY_SCAN,
    orderBy: [{ ratingAvg: { sort: "desc", nulls: "last" } }, { id: "asc" }],
    select: {
      id: true,
      name: true,
      type: true,
      guaranteeType: true,
      ratingAvg: true,
      ratingCount: true,
      branches: {
        where: {
          status: BranchStatus.ACTIVE,
          latitude: { not: null },
          longitude: { not: null },
        },
        select: { latitude: true, longitude: true },
      },
      services: {
        where: { status: ServiceStatus.ACTIVE },
        distinct: ["category"],
        select: { category: true },
      },
      products: {
        where: { status: ProductStatus.PUBLISHED },
        distinct: ["category"],
        select: { category: true },
      },
      _count: {
        select: {
          services: { where: { status: ServiceStatus.ACTIVE } },
          products: { where: { status: ProductStatus.PUBLISHED } },
        },
      },
    },
  });
  const covers = await db.product.findMany({
    where: {
      businessId: { in: rows.map((row) => row.id) },
      status: ProductStatus.PUBLISHED,
      imageUrl: { not: null },
    },
    distinct: ["businessId"],
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: { businessId: true, imageUrl: true },
  });
  const coverByBusiness = new Map(
    covers.map((cover) => [cover.businessId, cover.imageUrl]),
  );
  const items = rows
    .map((row) => ({
      id: row.id,
      name: row.name,
      type: row.type,
      guaranteeType: row.guaranteeType,
      ratingAvg: row.ratingAvg,
      ratingCount: row.ratingCount,
      distanceKm: nearestDistance(input.origin, row.branches),
      categories: [
        ...new Set([
          ...row.services.map(({ category }) => category),
          ...row.products.map(({ category }) => category),
        ]),
      ].sort((a, b) => a.localeCompare(b)),
      coverUrl: coverByBusiness.get(row.id) ?? null,
      servicesCount: row._count.services,
      productsCount: row._count.products,
    }))
    .sort(compareBusinesses);
  const cursorIndex = input.cursor
    ? items.findIndex((item) => item.id === input.cursor)
    : -1;

  if (input.cursor && cursorIndex === -1) {
    return fail("NOT_FOUND", 404, "Business cursor not found");
  }

  const page = items.slice(cursorIndex + 1, cursorIndex + 1 + PAGE_SIZE);
  const hasMore = cursorIndex + 1 + PAGE_SIZE < items.length;

  return ok(
    {
      items: page,
      nextCursor: hasMore ? (page.at(-1)?.id ?? null) : null,
    },
    "Marketplace businesses loaded",
  );
}

/**
 * D10-10 public profile of an ACTIVE business: guarantee, rating, ACTIVE
 * branches (with pickup flag and distance), ACTIVE services and PUBLISHED
 * products with per-branch availability (never the raw stock sum).
 */
export async function getMarketplaceBusiness(
  db: PrismaClient,
  input: { id: string; origin: GeoPoint | null },
): Promise<TrpcResponse<MarketplaceBusinessProfile>> {
  const business = await db.business.findFirst({
    where: { id: input.id, ...marketplaceBusinessWhere },
    select: {
      id: true,
      name: true,
      type: true,
      guaranteeType: true,
      guaranteeNotes: true,
      ratingAvg: true,
      ratingCount: true,
      branches: {
        where: { status: BranchStatus.ACTIVE },
        orderBy: [{ name: "asc" }, { id: "asc" }],
        select: {
          id: true,
          name: true,
          address: true,
          latitude: true,
          longitude: true,
          pickupEnabled: true,
        },
      },
      services: {
        where: { status: ServiceStatus.ACTIVE },
        orderBy: [{ name: "asc" }, { id: "asc" }],
        select: {
          id: true,
          name: true,
          category: true,
          basePriceCents: true,
          durationMinutes: true,
        },
      },
      products: {
        where: { status: ProductStatus.PUBLISHED },
        orderBy: [{ name: "asc" }, { id: "asc" }],
        select: {
          id: true,
          name: true,
          category: true,
          priceCents: true,
          imageUrl: true,
          stocks: { select: productBranchStockSelect },
        },
      },
    },
  });

  if (!business) {
    return fail("NOT_FOUND", 404, "Business not found");
  }

  return ok(
    {
      id: business.id,
      name: business.name,
      type: business.type,
      guaranteeType: business.guaranteeType,
      guaranteeNotes: business.guaranteeNotes,
      ratingAvg: business.ratingAvg,
      ratingCount: business.ratingCount,
      branches: business.branches.map((branch) => {
        const point =
          branch.latitude !== null && branch.longitude !== null
            ? branch.pickupEnabled
              ? { latitude: branch.latitude, longitude: branch.longitude }
              : {
                  latitude: approximateCoordinate(branch.latitude),
                  longitude: approximateCoordinate(branch.longitude),
                }
            : null;

        return {
          id: branch.id,
          name: branch.name,
          address: branch.pickupEnabled ? branch.address : null,
          latitude: point?.latitude ?? null,
          longitude: point?.longitude ?? null,
          pickupEnabled: branch.pickupEnabled,
          exactLocation: branch.pickupEnabled,
          distanceKm: distanceFrom(input.origin, point),
        };
      }),
      services: business.services,
      products: business.products.map(({ stocks, ...product }) => {
        const availability = summarizeAvailability(stocks, input.origin);

        return {
          ...product,
          available: availability.available,
          lowStock: availability.lowStock,
        };
      }),
    },
    "Marketplace business loaded",
  );
}

/** D10-10 service detail (ACTIVE service of an ACTIVE business). */
export async function getMarketplaceService(
  db: PrismaClient,
  id: string,
): Promise<TrpcResponse<MarketplaceServiceDetail>> {
  const service = await db.service.findFirst({
    where: {
      id,
      status: ServiceStatus.ACTIVE,
      business: marketplaceBusinessWhere,
    },
    select: {
      id: true,
      name: true,
      category: true,
      basePriceCents: true,
      durationMinutes: true,
      durationMaxMinutes: true,
      businessId: true,
      business: {
        select: {
          id: true,
          name: true,
          ratingAvg: true,
          ratingCount: true,
          guaranteeType: true,
        },
      },
    },
  });

  if (!service) {
    return fail("NOT_FOUND", 404, "Service not found");
  }

  return ok(service, "Marketplace service loaded");
}
