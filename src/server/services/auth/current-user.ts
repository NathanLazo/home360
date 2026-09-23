import type {
  BusinessStatus,
  PrismaClient,
  WorkerAvailability,
} from "@generated/prisma";
import {
  fail,
  normalizeError,
  ok,
  type TrpcResponse,
} from "~/server/api/contract";

type MeBase = {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
};

/**
 * Single shape discriminated by `role` (M1-W1). The app switches its shell
 * mode (C/N/T) on `role` and narrows the extra fields without casting.
 * ADMIN and CORPORATE only carry the base fields: neither has a mobile mode.
 */
export type MeResult =
  | (MeBase & { role: "CUSTOMER"; hasProfile: boolean })
  | (MeBase & {
      role: "BUSINESS";
      businessId: string;
      businessName: string;
      status: BusinessStatus;
    })
  | (MeBase & {
      role: "WORKER";
      workerId: string;
      businessId: string;
      businessName: string;
      fullName: string;
      specialty: string | null;
      availability: WorkerAvailability;
      /** Minimal branch for T4 (P-WEB-02); null when unassigned. */
      branch: { id: string; name: string } | null;
    })
  | (MeBase & { role: "ADMIN" | "CORPORATE" });

/**
 * Resolves the session user's profile. The user id always comes from the
 * session, never from input. A BUSINESS or WORKER session whose backing row is
 * missing answers a generic `NOT_FOUND` without revealing which piece failed,
 * mirroring the guards in `trpc.ts`.
 */
export const getCurrentUser = async (
  db: PrismaClient,
  userId: string,
): Promise<TrpcResponse<MeResult>> => {
  try {
    const user = await db.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        role: true,
        customerProfile: { select: { id: true } },
        business: { select: { id: true, name: true, status: true } },
        workerProfile: {
          select: {
            id: true,
            fullName: true,
            specialty: true,
            availability: true,
            business: { select: { id: true, name: true } },
            branch: { select: { id: true, name: true } },
          },
        },
      },
    });

    if (!user) {
      return fail("NOT_FOUND", 404, "User not found");
    }

    const base: MeBase = {
      id: user.id,
      name: user.name,
      email: user.email,
      image: user.image,
    };

    switch (user.role) {
      case "CUSTOMER":
        return ok(
          {
            ...base,
            role: "CUSTOMER",
            hasProfile: user.customerProfile !== null,
          },
          "Current user",
        );
      case "BUSINESS": {
        if (!user.business) {
          return fail("NOT_FOUND", 404, "Business profile not found");
        }

        return ok(
          {
            ...base,
            role: "BUSINESS",
            businessId: user.business.id,
            businessName: user.business.name,
            status: user.business.status,
          },
          "Current user",
        );
      }
      case "WORKER": {
        if (!user.workerProfile) {
          return fail("NOT_FOUND", 404, "Worker profile not found");
        }

        return ok(
          {
            ...base,
            role: "WORKER",
            workerId: user.workerProfile.id,
            businessId: user.workerProfile.business.id,
            businessName: user.workerProfile.business.name,
            fullName: user.workerProfile.fullName,
            specialty: user.workerProfile.specialty,
            availability: user.workerProfile.availability,
            branch: user.workerProfile.branch,
          },
          "Current user",
        );
      }
      default:
        return ok({ ...base, role: user.role }, "Current user");
    }
  } catch (error: unknown) {
    const { code, status } = normalizeError(error);
    return fail(code, status, "Could not resolve the current user");
  }
};
