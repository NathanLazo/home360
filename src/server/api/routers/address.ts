import { z } from "zod";

import {
  fail,
  normalizeError,
  ok,
  type TrpcResponse,
} from "~/server/api/contract";
import { createTRPCRouter, userProcedure } from "~/server/api/trpc";
import {
  createAddress,
  deleteAddress,
  listAddresses,
  setDefaultAddress,
  updateAddress,
} from "~/server/services/account/address";

const addressFieldsSchema = z.object({
  label: z.string().trim().min(1).max(80),
  addressLine: z.string().trim().min(1).max(200),
  // Structured colonia (MA-13); optional until the mobile form ships it.
  neighborhood: z.string().trim().min(1).max(120).optional(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

const createAddressSchema = addressFieldsSchema.extend({
  isDefault: z.boolean().optional(),
});

const updateAddressSchema = addressFieldsSchema
  .partial()
  .extend({ id: z.string().cuid() })
  .refine(
    (input) =>
      input.label !== undefined ||
      input.addressLine !== undefined ||
      input.neighborhood !== undefined ||
      input.latitude !== undefined ||
      input.longitude !== undefined,
    { message: "At least one field is required" },
  );

const addressIdSchema = z.object({ id: z.string().cuid() });

const serviceErrorStatuses = {
  NOT_FOUND: 404,
  CONFLICT: 409,
  ADDRESS_LIMIT_REACHED: 409,
  STRIPE_ERROR: 502,
} as const satisfies Record<string, number>;

type ServiceErrorCode = keyof typeof serviceErrorStatuses;

function serviceFailure(
  code: ServiceErrorCode,
  message: string,
): TrpcResponse<never, ServiceErrorCode> {
  return fail(code, serviceErrorStatuses[code], message);
}

function unexpectedFailure(
  error: unknown,
  message: string,
): TrpcResponse<never> {
  const normalized = normalizeError(error);
  return fail(normalized.code, normalized.status, message);
}

/**
 * Saved addresses of the session customer (M2-W3). Capped at 10 per user with
 * a single default; a foreign address always answers a generic NOT_FOUND.
 */
export const addressRouter = createTRPCRouter({
  list: userProcedure.query(async ({ ctx }) => {
    try {
      const list = await listAddresses(ctx.db, ctx.customer.id);

      if (!list.ok) {
        return serviceFailure(list.code, "Address list failed");
      }

      return ok(list.data, "Addresses loaded");
    } catch (error) {
      return unexpectedFailure(error, "Address list failed");
    }
  }),

  create: userProcedure
    .input(createAddressSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const created = await createAddress(ctx.db, ctx.customer.id, input);

        if (!created.ok) {
          return serviceFailure(created.code, "Address creation failed");
        }

        return ok(created.data, "Address created", 201);
      } catch (error) {
        return unexpectedFailure(error, "Address creation failed");
      }
    }),

  update: userProcedure
    .input(updateAddressSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const updated = await updateAddress(ctx.db, ctx.customer.id, input);

        if (!updated.ok) {
          return serviceFailure(updated.code, "Address update failed");
        }

        return ok(updated.data, "Address updated");
      } catch (error) {
        return unexpectedFailure(error, "Address update failed");
      }
    }),

  delete: userProcedure
    .input(addressIdSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const deleted = await deleteAddress(ctx.db, ctx.customer.id, input.id);

        if (!deleted.ok) {
          return serviceFailure(deleted.code, "Address deletion failed");
        }

        return ok(deleted.data, "Address deleted");
      } catch (error) {
        return unexpectedFailure(error, "Address deletion failed");
      }
    }),

  setDefault: userProcedure
    .input(addressIdSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const updated = await setDefaultAddress(
          ctx.db,
          ctx.customer.id,
          input.id,
        );

        if (!updated.ok) {
          return serviceFailure(updated.code, "Default address change failed");
        }

        return ok(updated.data, "Default address changed");
      } catch (error) {
        return unexpectedFailure(error, "Default address change failed");
      }
    }),
});
