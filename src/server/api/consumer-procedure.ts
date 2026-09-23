import { TRPCError } from "@trpc/server";

import { protectedProcedure } from "~/server/api/trpc";

/**
 * Consumer context (F7 + workstream D): whoever buys on the marketplace. A
 * CUSTOMER buys for itself; an ACTIVE corporate owner buys on behalf of its
 * account and must attach one of its locations to every request.
 */
export type ConsumerContext =
  | { kind: "CUSTOMER"; userId: string; corporateAccountId: null }
  | { kind: "CORPORATE"; userId: string; corporateAccountId: string };

/**
 * CUSTOMER or ACTIVE CORPORATE. The corporate account is resolved from the
 * session owner (never from input) and any non-active account answers the
 * same generic FORBIDDEN as `activeCorporateProcedure`. `ctx.customer` keeps
 * the `userProcedure` shape so customer services work unchanged: the corporate
 * owner user is the `customerId` of the orders it generates.
 */
export const consumerProcedure = protectedProcedure.use(
  async ({ ctx, next }) => {
    const { role, id } = ctx.session.user;

    if (role === "CUSTOMER") {
      const consumer: ConsumerContext = {
        kind: "CUSTOMER",
        userId: id,
        corporateAccountId: null,
      };

      return next({ ctx: { ...ctx, consumer, customer: { id } } });
    }

    if (role !== "CORPORATE") {
      throw new TRPCError({ code: "FORBIDDEN" });
    }

    const account = await ctx.db.corporateAccount.findUnique({
      where: { ownerId: id },
      select: { id: true, status: true },
    });

    if (account?.status !== "ACTIVE") {
      throw new TRPCError({ code: "FORBIDDEN" });
    }

    const consumer: ConsumerContext = {
      kind: "CORPORATE",
      userId: id,
      corporateAccountId: account.id,
    };

    return next({ ctx: { ...ctx, consumer, customer: { id } } });
  },
);
