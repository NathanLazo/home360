import { ServiceStatus } from "../../../../generated/prisma";
import { z } from "zod";

import {
  serviceCreateSchema,
  serviceListSchema,
  serviceUpdateSchema,
} from "~/app/[locale]/dashboard/services/_components/service.schema";
import { fail, normalizeError } from "~/server/api/contract";
import {
  activeBusinessProcedure,
  businessProcedure,
  createTRPCRouter,
} from "~/server/api/trpc";
import {
  createService,
  deleteService,
  listServiceCategories,
  listServices,
  listServiceWorkers,
  setServiceStatus,
  updateService,
} from "~/server/services/catalog/service-catalog";

const serviceIdSchema = z.object({ id: z.string().cuid() });
const serviceStatusSchema = serviceIdSchema.extend({
  status: z.nativeEnum(ServiceStatus),
});

function serviceFailure(error: unknown) {
  const normalized = normalizeError(error);
  return fail(normalized.code, normalized.status, "Service operation failed");
}

export const serviceRouter = createTRPCRouter({
  list: businessProcedure
    .input(serviceListSchema)
    .query(async ({ ctx, input }) => {
      try {
        return await listServices(ctx.db, ctx.business.id, input);
      } catch (error) {
        return serviceFailure(error);
      }
    }),

  listCategories: businessProcedure.query(async ({ ctx }) => {
    try {
      return await listServiceCategories(ctx.db, ctx.business.id);
    } catch (error) {
      return serviceFailure(error);
    }
  }),

  listWorkers: businessProcedure.query(async ({ ctx }) => {
    try {
      return await listServiceWorkers(ctx.db, ctx.business.id);
    } catch (error) {
      return serviceFailure(error);
    }
  }),

  create: activeBusinessProcedure
    .input(serviceCreateSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        return await createService(ctx.db, ctx.business.id, input);
      } catch (error) {
        return serviceFailure(error);
      }
    }),

  update: activeBusinessProcedure
    .input(serviceUpdateSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        return await updateService(ctx.db, ctx.business.id, input);
      } catch (error) {
        return serviceFailure(error);
      }
    }),

  setStatus: activeBusinessProcedure
    .input(serviceStatusSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        return await setServiceStatus(ctx.db, ctx.business.id, input);
      } catch (error) {
        return serviceFailure(error);
      }
    }),

  delete: activeBusinessProcedure
    .input(serviceIdSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        return await deleteService(ctx.db, ctx.business.id, input.id);
      } catch (error) {
        return serviceFailure(error);
      }
    }),
});
