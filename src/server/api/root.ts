import { ok } from "~/server/api/contract";
import { adminRouter } from "~/server/api/routers/admin";
import { authRouter } from "~/server/api/routers/auth";
import { branchRouter } from "~/server/api/routers/branch";
import { businessSettingsRouter } from "~/server/api/routers/business-settings";
import { dashboardRouter } from "~/server/api/routers/dashboard";
import { orderRouter } from "~/server/api/routers/order";
import { paymentRouter } from "~/server/api/routers/payment";
import { productRouter } from "~/server/api/routers/product";
import { serviceRouter } from "~/server/api/routers/service";
import { subscriptionRouter } from "~/server/api/routers/subscription";
import { teamRouter } from "~/server/api/routers/team";
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
  admin: adminRouter,
  auth: authRouter,
  branch: branchRouter,
  businessSettings: businessSettingsRouter,
  dashboard: dashboardRouter,
  health: publicProcedure.query(() => ok({ ready: true }, "API is ready")),
  order: orderRouter,
  payment: paymentRouter,
  product: productRouter,
  service: serviceRouter,
  subscription: subscriptionRouter,
  team: teamRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;

/**
 * Create a server-side caller for the tRPC API.
 */
export const createCaller = createCallerFactory(appRouter);
