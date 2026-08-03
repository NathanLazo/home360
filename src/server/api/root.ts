import { ok } from "~/server/api/contract";
import { authRouter } from "~/server/api/routers/auth";
import { branchRouter } from "~/server/api/routers/branch";
import { dashboardRouter } from "~/server/api/routers/dashboard";
import { orderRouter } from "~/server/api/routers/order";
import { productRouter } from "~/server/api/routers/product";
import { serviceRouter } from "~/server/api/routers/service";
import {
  createCallerFactory,
  createTRPCRouter,
  publicProcedure,
} from "~/server/api/trpc";

/**
 * This is the primary router for your server.
 *
 * All routers added in /api/routers should be manually added here.
 */
export const appRouter = createTRPCRouter({
  auth: authRouter,
  branch: branchRouter,
  dashboard: dashboardRouter,
  health: publicProcedure.query(() => ok({ ready: true }, "API is ready")),
  order: orderRouter,
  product: productRouter,
  service: serviceRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;

/**
 * Create a server-side caller for the tRPC API.
 */
export const createCaller = createCallerFactory(appRouter);
