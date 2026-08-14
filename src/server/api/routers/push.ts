import {
  registerPushTokenSchema,
  unregisterPushTokenSchema,
} from "~/server/api/schemas/push-token.schema";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import {
  registerPushToken,
  unregisterPushToken,
} from "~/server/services/push/push-tokens";

/**
 * Push token registry (M1-W1). Any authenticated role may register a device
 * token; sending pushes is out of scope until M7-W1.
 */
export const pushRouter = createTRPCRouter({
  registerToken: protectedProcedure
    .input(registerPushTokenSchema)
    .mutation(({ ctx, input }) =>
      registerPushToken(ctx.db, ctx.session.user.id, input),
    ),
  unregisterToken: protectedProcedure
    .input(unregisterPushTokenSchema)
    .mutation(({ ctx, input }) =>
      unregisterPushToken(ctx.db, ctx.session.user.id, input),
    ),
});
