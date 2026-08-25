import { ok } from "~/server/api/contract";
import { addressRouter } from "~/server/api/routers/address";
import { adminRouter } from "~/server/api/routers/admin";
import { authRouter } from "~/server/api/routers/auth";
import { branchRouter } from "~/server/api/routers/branch";
import { businessSettingsRouter } from "~/server/api/routers/business-settings";
import { corporateRouter } from "~/server/api/routers/corporate";
import { dashboardRouter } from "~/server/api/routers/dashboard";
import { marketplaceRouter } from "~/server/api/routers/marketplace";
import { mediaRouter } from "~/server/api/routers/media";
import { messagingRouter } from "~/server/api/routers/messaging";
import { orderRouter } from "~/server/api/routers/order";
import { paymentRouter } from "~/server/api/routers/payment";
import { productRouter } from "~/server/api/routers/product";
import { pushRouter } from "~/server/api/routers/push";
import { quoteRouter } from "~/server/api/routers/quote";
import { requestRouter } from "~/server/api/routers/request";
import { serviceRouter } from "~/server/api/routers/service";
import { subscriptionRouter } from "~/server/api/routers/subscription";
import { teamRouter } from "~/server/api/routers/team";
import { trackingRouter } from "~/server/api/routers/tracking";
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
  address: addressRouter,
  admin: adminRouter,
  auth: authRouter,
  branch: branchRouter,
  businessSettings: businessSettingsRouter,
  corporate: corporateRouter,
  dashboard: dashboardRouter,
  health: publicProcedure.query(() => ok({ ready: true }, "API is ready")),
  marketplace: marketplaceRouter,
  media: mediaRouter,
  messaging: messagingRouter,
  order: orderRouter,
  payment: paymentRouter,
  product: productRouter,
  push: pushRouter,
  quote: quoteRouter,
  request: requestRouter,
  service: serviceRouter,
  subscription: subscriptionRouter,
  team: teamRouter,
  tracking: trackingRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;

/**
 * Create a server-side caller for the tRPC API.
 */
export const createCaller = createCallerFactory(appRouter);
