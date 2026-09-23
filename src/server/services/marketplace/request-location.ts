import "server-only";

import type { PrismaClient } from "@generated/prisma";
import { svcFail, svcOk, type ServiceResult } from "../service-result";

/**
 * Where the work happens. A CUSTOMER picks one of its saved addresses; an
 * active corporate account picks one of its ACTIVE locations (F7). Both are
 * validated against the session tenant inside the Prisma where.
 */
export type RequestLocationInput =
  | { kind: "ADDRESS"; customerId: string; addressId: string }
  | {
      kind: "CORPORATE_LOCATION";
      corporateAccountId: string;
      corporateLocationId: string;
    };

export type ResolvedRequestLocation = {
  addressLine: string;
  neighborhood: string | null;
  latitude: number | null;
  longitude: number | null;
  corporateAccountId: string | null;
  corporateLocationId: string | null;
};

export async function resolveRequestLocation(
  db: PrismaClient,
  input: RequestLocationInput,
): Promise<ServiceResult<ResolvedRequestLocation>> {
  if (input.kind === "ADDRESS") {
    const address = await db.address.findFirst({
      where: { id: input.addressId, userId: input.customerId },
      select: {
        addressLine: true,
        neighborhood: true,
        latitude: true,
        longitude: true,
      },
    });

    if (!address) {
      return svcFail("NOT_FOUND", "Address not found");
    }

    return svcOk({
      ...address,
      corporateAccountId: null,
      corporateLocationId: null,
    });
  }

  const location = await db.corporateLocation.findFirst({
    where: {
      id: input.corporateLocationId,
      corporateAccountId: input.corporateAccountId,
      isActive: true,
    },
    select: { id: true, addressLine: true, city: true },
  });

  if (!location) {
    return svcFail("NOT_FOUND", "Corporate location not found");
  }

  // CorporateLocation has no coordinates yet: the request carries the full
  // textual address and no geo (radar falls back to category matching).
  return svcOk({
    addressLine: `${location.addressLine}, ${location.city}`,
    neighborhood: null,
    latitude: null,
    longitude: null,
    corporateAccountId: input.corporateAccountId,
    corporateLocationId: location.id,
  });
}
