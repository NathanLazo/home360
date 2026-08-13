/**
 * YOU PROBABLY DON'T NEED TO EDIT THIS FILE, UNLESS:
 * 1. You want to modify request context (see Part 1).
 * 2. You want to create a new middleware or type of procedure (see Part 3).
 *
 * TL;DR - This is where all the tRPC server stuff is created and plugged in. The pieces you will
 * need to use are documented accordingly near the end.
 */

import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { ZodError } from "zod";

import type {
  BusinessStatus,
  SubscriptionStatus,
} from "../../../generated/prisma";
import { auth } from "~/server/auth";
import { db } from "~/server/db";
import type { PlanLimits } from "~/server/services/subscription/plan-limits";

/**
 * Flattened business context (F0-05): the plan travels as a plain object, never
 * nested under `subscription`, so services take it without casting.
 */
type BusinessContext = {
  id: string;
  status: BusinessStatus;
  plan: (PlanLimits & { commissionPct: number }) | null;
  subscriptionStatus: SubscriptionStatus | null;
};

type CustomerContext = {
  id: string;
};

/**
 * 1. CONTEXT
 *
 * This section defines the "contexts" that are available in the backend API.
 *
 * These allow you to access things when processing a request, like the database, the session, etc.
 *
 * This helper generates the "internals" for a tRPC context. The API handler and RSC clients each
 * wrap this and provides the required context.
 *
 * @see https://trpc.io/docs/server/context
 */
export const createTRPCContext = async (opts: { headers: Headers }) => {
  const session = await auth();

  return {
    db,
    session,
    ...opts,
  };
};

/**
 * 2. INITIALIZATION
 *
 * This is where the tRPC API is initialized, connecting the context and transformer. We also parse
 * ZodErrors so that you get typesafety on the frontend if your procedure fails due to validation
 * errors on the backend.
 */
const t = initTRPC.context<typeof createTRPCContext>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError:
          error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    };
  },
});

/**
 * Create a server-side caller.
 *
 * @see https://trpc.io/docs/server/server-side-calls
 */
export const createCallerFactory = t.createCallerFactory;

/**
 * 3. ROUTER & PROCEDURE (THE IMPORTANT BIT)
 *
 * These are the pieces you use to build your tRPC API. You should import these a lot in the
 * "/src/server/api/routers" directory.
 */

/**
 * This is how you create new routers and sub-routers in your tRPC API.
 *
 * @see https://trpc.io/docs/router
 */
export const createTRPCRouter = t.router;

/**
 * Middleware for timing procedure execution and adding an artificial delay in development.
 *
 * You can remove this if you don't like it, but it can help catch unwanted waterfalls by simulating
 * network latency that would occur in production but not in local development.
 */
const timingMiddleware = t.middleware(async ({ next, path }) => {
  const start = Date.now();

  if (t._config.isDev) {
    // artificial delay in dev
    const waitMs = Math.floor(Math.random() * 400) + 100;
    await new Promise((resolve) => setTimeout(resolve, waitMs));
  }

  const result = await next();

  const end = Date.now();
  console.log(`[TRPC] ${path} took ${end - start}ms to execute`);

  return result;
});

/**
 * Public (unauthenticated) procedure
 *
 * This is the base piece you use to build new queries and mutations on your tRPC API. It does not
 * guarantee that a user querying is authorized, but you can still access user session data if they
 * are logged in.
 */
export const publicProcedure = t.procedure.use(timingMiddleware);

/**
 * Protected (authenticated) procedure
 *
 * If you want a query or mutation to ONLY be accessible to logged in users, use this. It verifies
 * the session is valid and guarantees `ctx.session.user` is not null.
 *
 * @see https://trpc.io/docs/procedures
 */
export const protectedProcedure = t.procedure
  .use(timingMiddleware)
  .use(({ ctx, next }) => {
    if (!ctx.session?.user || ctx.session.user.authInvalidated) {
      throw new TRPCError({ code: "UNAUTHORIZED" });
    }
    return next({
      ctx: {
        // infers the `session` as non-nullable
        session: { ...ctx.session, user: ctx.session.user },
      },
    });
  });

export const userProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.session.user.role !== "CUSTOMER") {
    throw new TRPCError({ code: "FORBIDDEN" });
  }

  const customer: CustomerContext = {
    id: ctx.session.user.id,
  };

  return next({
    ctx: {
      ...ctx,
      customer,
    },
  });
});

export const businessProcedure = protectedProcedure.use(
  async ({ ctx, next }) => {
    if (ctx.session.user.role !== "BUSINESS") {
      throw new TRPCError({ code: "FORBIDDEN" });
    }

    const businessRecord = await ctx.db.business.findUnique({
      where: {
        ownerId: ctx.session.user.id,
      },
      select: {
        id: true,
        status: true,
        subscription: {
          select: {
            status: true,
            plan: {
              select: {
                commissionPct: true,
                maxBranches: true,
                maxWorkers: true,
                maxProducts: true,
              },
            },
          },
        },
      },
    });

    if (!businessRecord) {
      throw new TRPCError({ code: "FORBIDDEN" });
    }

    const business: BusinessContext = {
      id: businessRecord.id,
      status: businessRecord.status,
      plan: businessRecord.subscription?.plan ?? null,
      subscriptionStatus: businessRecord.subscription?.status ?? null,
    };

    return next({
      ctx: {
        ...ctx,
        business,
      },
    });
  },
);

/**
 * F4 extends this guard with the subscription state (spec/04 §2).
 *
 * `CANCELED` degrades the business to read-only, and a missing subscription
 * breaks the F5-05 invariant that an ACTIVE business always has one, so neither
 * may move money or mutate the catalogue. `PAST_DUE` passes: arrears show a
 * banner but never block operations. The check lives here and only here; the UI
 * tells the two reasons apart through `subscription.getCurrent`, which
 * `businessProcedure` still allows.
 */
export const activeBusinessProcedure = businessProcedure.use(
  ({ ctx, next }) => {
    if (ctx.business.status !== "ACTIVE") {
      throw new TRPCError({ code: "FORBIDDEN" });
    }

    if (
      ctx.business.subscriptionStatus === null ||
      ctx.business.subscriptionStatus === "CANCELED"
    ) {
      throw new TRPCError({ code: "FORBIDDEN" });
    }

    return next();
  },
);

/**
 * Corporate tenant guard (F7-02, spec/09 §4).
 *
 * The account is resolved from the session owner, never from input, in a
 * single query per request. A wrong role and a missing account both answer
 * with the same generic FORBIDDEN so the response never reveals whether the
 * resource exists. The `ctx.corporateAccount` type is inferred from the
 * Prisma `select`, so there is no parallel interface to drift out of sync.
 */
export const corporateProcedure = protectedProcedure.use(
  async ({ ctx, next }) => {
    if (ctx.session.user.role !== "CORPORATE") {
      throw new TRPCError({ code: "FORBIDDEN" });
    }

    const corporateAccount = await ctx.db.corporateAccount.findUnique({
      where: {
        ownerId: ctx.session.user.id,
      },
      select: {
        id: true,
        name: true,
        tier: true,
        status: true,
        commissionPct: true,
        maxLocations: true,
      },
    });

    if (!corporateAccount) {
      throw new TRPCError({ code: "FORBIDDEN" });
    }

    return next({
      ctx: {
        ...ctx,
        corporateAccount,
      },
    });
  },
);

/**
 * Only ACTIVE corporate accounts pass. PENDING, SUSPENDED and CANCELLED get
 * the same generic 403; reads under `corporateProcedure` stay available so
 * the account can still see its own status, membership and history.
 */
export const activeCorporateProcedure = corporateProcedure.use(
  ({ ctx, next }) => {
    if (ctx.corporateAccount.status !== "ACTIVE") {
      throw new TRPCError({ code: "FORBIDDEN" });
    }

    return next();
  },
);

export const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.session.user.role !== "ADMIN") {
    throw new TRPCError({ code: "FORBIDDEN" });
  }

  return next();
});
