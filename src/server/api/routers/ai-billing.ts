import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { env } from "~/env";
import { splitLocaleFromPathname, type Locale } from "~/i18n/locale-pathname";
import { routing } from "~/i18n/routing";
import { agentAreaForRole, type AgentArea } from "~/lib/agent/agent-area";
import {
  fail,
  normalizeError,
  ok,
  type TrpcResponse,
} from "~/server/api/contract";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { createCreditCheckout } from "~/server/services/ai-billing/create-credit-checkout";
import {
  AI_CREDIT_PACKS,
  type AiCreditPackCode,
} from "~/server/services/ai-billing/credit-packs";
import {
  resolveAiBillingTenant,
  type AiBillingTenant,
} from "~/server/services/ai-billing/tenant";
import {
  getAiBillingSummary,
  listAiPurchases,
  listAiUsage,
  type AiBillingSummary,
  type AiPurchaseRow,
  type AiUsageRow,
} from "~/server/services/ai-billing/usage-summary";
import { getStripe } from "~/server/services/stripe/client";

const USAGE_PAGE_SIZE = 25;
const PURCHASES_LIMIT = 20;

const packCodes = AI_CREDIT_PACKS.map((pack) => pack.code) as [
  AiCreditPackCode,
  ...AiCreditPackCode[],
];

const listUsageSchema = z.object({
  cursor: z.string().cuid().nullish(),
});

const createCheckoutSchema = z.object({
  packCode: z.enum(packCodes),
  /** Localized product label; the server never renders copy. */
  lineItemLabel: z.string().trim().min(1).max(120),
});

/** Same guard as the assistant: only panel roles have a wallet or a ledger. */
const aiBillingProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  const area = agentAreaForRole(ctx.session.user.role);

  if (!area) {
    throw new TRPCError({ code: "FORBIDDEN" });
  }

  const tenant = await resolveAiBillingTenant(ctx.db, {
    area,
    userId: ctx.session.user.id,
  });

  if (!tenant) {
    throw new TRPCError({ code: "FORBIDDEN" });
  }

  return next({
    ctx: { ...ctx, aiBilling: { area, tenant, userId: ctx.session.user.id } },
  });
});

function unexpectedFailure(
  error: unknown,
  message: string,
): TrpcResponse<never> {
  const normalized = normalizeError(error);
  return fail(normalized.code, normalized.status, message);
}

function localeFromHeaders(headers: Headers): Locale {
  const referer = headers.get("referer");

  if (!referer) {
    return routing.defaultLocale;
  }

  try {
    const { locale } = splitLocaleFromPathname(new URL(referer).pathname);
    return locale ?? routing.defaultLocale;
  } catch {
    return routing.defaultLocale;
  }
}

/** Profile page of the area, where the wallet lives. */
function profileUrl(locale: Locale, area: AgentArea, query: string): string {
  const base: Record<AgentArea, string> = {
    business: "/dashboard/settings/profile",
    corporate: "/corporate/settings/profile",
    admin: "/admin/settings/profile",
  };
  const prefix = locale === routing.defaultLocale ? "" : `/${locale}`;

  return new URL(`${prefix}${base[area]}${query}`, env.APP_URL).toString();
}

export const aiBillingRouter = createTRPCRouter({
  getSummary: aiBillingProcedure.query(
    async ({ ctx }): Promise<TrpcResponse<AiBillingSummary>> => {
      try {
        const summary = await getAiBillingSummary(ctx.db, {
          tenant: ctx.aiBilling.tenant,
          userId: ctx.aiBilling.userId,
        });
        return ok(summary, "AI billing summary retrieved");
      } catch (error: unknown) {
        return unexpectedFailure(error, "Unable to load the AI billing summary");
      }
    },
  ),

  listUsage: aiBillingProcedure.input(listUsageSchema).query(
    async ({
      ctx,
      input,
    }): Promise<
      TrpcResponse<{ items: AiUsageRow[]; nextCursor: string | null }>
    > => {
      try {
        const page = await listAiUsage(ctx.db, {
          tenant: ctx.aiBilling.tenant,
          userId: ctx.aiBilling.userId,
          cursor: input.cursor ?? null,
          limit: USAGE_PAGE_SIZE,
        });
        return ok(page, "AI usage retrieved");
      } catch (error: unknown) {
        return unexpectedFailure(error, "Unable to list AI usage");
      }
    },
  ),

  listPurchases: aiBillingProcedure.query(
    async ({ ctx }): Promise<TrpcResponse<AiPurchaseRow[]>> => {
      try {
        const purchases = await listAiPurchases(ctx.db, {
          tenant: ctx.aiBilling.tenant,
          limit: PURCHASES_LIMIT,
        });
        return ok(purchases, "AI credit purchases retrieved");
      } catch (error: unknown) {
        return unexpectedFailure(error, "Unable to list AI credit purchases");
      }
    },
  ),

  createCreditCheckout: aiBillingProcedure
    .input(createCheckoutSchema)
    .mutation(
      async ({
        ctx,
        input,
      }): Promise<TrpcResponse<{ url: string }, "AI_WALLET_LIMIT">> => {
        const tenant: AiBillingTenant = ctx.aiBilling.tenant;

        if (tenant.kind === "internal") {
          return fail("FORBIDDEN", 403, "Internal usage has no wallet");
        }

        try {
          const locale = localeFromHeaders(ctx.headers);
          const checkout = await createCreditCheckout(
            { db: ctx.db, stripe: getStripe() },
            {
              tenant,
              packCode: input.packCode,
              lineItemLabel: input.lineItemLabel,
              successUrl: profileUrl(
                locale,
                ctx.aiBilling.area,
                "?credits=success#billing",
              ),
              cancelUrl: profileUrl(
                locale,
                ctx.aiBilling.area,
                "?credits=cancelled#billing",
              ),
            },
          );

          if (!checkout.ok) {
            switch (checkout.code) {
              case "AI_WALLET_LIMIT":
                return fail("AI_WALLET_LIMIT", 409, "Wallet ceiling reached");
              case "FORBIDDEN":
                return fail("FORBIDDEN", 403, "Internal usage has no wallet");
              case "NOT_FOUND":
                return fail("NOT_FOUND", 404, "Tenant not found");
              case "STRIPE_ERROR":
                return fail("STRIPE_ERROR", 502, "Stripe rejected the checkout");
              case "CONFLICT":
                return fail("CONFLICT", 409, "Tenant billing is inconsistent");
            }
          }

          return ok(checkout.data, "Checkout Session created", 201);
        } catch (error: unknown) {
          return unexpectedFailure(error, "Unable to start the token purchase");
        }
      },
    ),
});
