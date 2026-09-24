import "server-only";

import Stripe from "stripe";

import type { PrismaClient } from "@generated/prisma";
import { AI_WALLET_MAX_USD_MICROS } from "~/lib/agent/agent-pricing";
import { ensureCorporateStripeCustomer } from "~/server/services/corporate/corporate-billing";
import {
  svcFail,
  svcOk,
  type ServiceResult,
} from "~/server/services/service-result";
import { ensureStripeCustomer } from "~/server/services/subscription/billing";
import { getAiCreditPack, type AiCreditPackCode } from "./credit-packs";
import type { AiBillingTenant } from "./tenant";

export type CreateCreditCheckoutDeps = {
  db: PrismaClient;
  stripe: Stripe;
};

export type CreateCreditCheckoutInput = {
  tenant: AiBillingTenant;
  packCode: AiCreditPackCode;
  successUrl: string;
  cancelUrl: string;
  /** Localized line-item label ("Tokens del asistente — paquete M"). */
  lineItemLabel: string;
};

type CreditCheckoutErrorCode = "FORBIDDEN" | "AI_WALLET_LIMIT";

function isStripeError(error: unknown): error is Stripe.errors.StripeError {
  return error instanceof Stripe.errors.StripeError;
}

/**
 * Hosted Stripe Checkout (mode payment, USD) for a token pack. The purchase
 * row is created PENDING first so the webhook can locate it through
 * `metadata.aiCreditPurchaseId`; `checkout.session.completed` credits it.
 */
export async function createCreditCheckout(
  deps: CreateCreditCheckoutDeps,
  input: CreateCreditCheckoutInput,
): Promise<ServiceResult<{ url: string }, CreditCheckoutErrorCode>> {
  if (input.tenant.kind === "internal") {
    return svcFail("FORBIDDEN", "Internal usage has no wallet");
  }

  const pack = getAiCreditPack(input.packCode);

  const wallet =
    input.tenant.kind === "business"
      ? await deps.db.business.findUnique({
          where: { id: input.tenant.businessId },
          select: { aiCreditUsdMicros: true },
        })
      : await deps.db.corporateAccount.findUnique({
          where: { id: input.tenant.corporateAccountId },
          select: { aiCreditUsdMicros: true },
        });

  if (!wallet) {
    return svcFail("NOT_FOUND", "Tenant not found");
  }

  if (wallet.aiCreditUsdMicros + pack.creditUsdMicros > AI_WALLET_MAX_USD_MICROS) {
    return svcFail("AI_WALLET_LIMIT", "Wallet ceiling reached");
  }

  const customer =
    input.tenant.kind === "business"
      ? await ensureStripeCustomer(deps, { businessId: input.tenant.businessId })
      : await ensureCorporateStripeCustomer(deps, {
          accountId: input.tenant.corporateAccountId,
        });

  if (!customer.ok) {
    return customer;
  }

  const purchase = await deps.db.aiCreditPurchase.create({
    data: {
      ...(input.tenant.kind === "business"
        ? { businessId: input.tenant.businessId }
        : { corporateAccountId: input.tenant.corporateAccountId }),
      packCode: pack.code,
      amountUsdCents: pack.amountUsdCents,
      creditUsdMicros: pack.creditUsdMicros,
    },
    select: { id: true },
  });

  try {
    const session = await deps.stripe.checkout.sessions.create(
      {
        mode: "payment",
        customer: customer.data.stripeCustomerId,
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: "usd",
              unit_amount: pack.amountUsdCents,
              product_data: { name: input.lineItemLabel },
            },
          },
        ],
        success_url: input.successUrl,
        cancel_url: input.cancelUrl,
        metadata: { aiCreditPurchaseId: purchase.id },
        payment_intent_data: {
          description: input.lineItemLabel,
          metadata: { aiCreditPurchaseId: purchase.id },
        },
      },
      { idempotencyKey: `ai-credit-checkout-${purchase.id}` },
    );

    if (!session.url) {
      return svcFail("STRIPE_ERROR", "Checkout Session has no url");
    }

    await deps.db.aiCreditPurchase.update({
      where: { id: purchase.id },
      data: { stripeCheckoutSessionId: session.id },
      select: { id: true },
    });

    return svcOk({ url: session.url });
  } catch (error: unknown) {
    await deps.db.aiCreditPurchase.update({
      where: { id: purchase.id },
      data: { status: "FAILED" },
      select: { id: true },
    });

    if (isStripeError(error)) {
      return svcFail("STRIPE_ERROR", "Checkout Session creation failed");
    }

    throw error;
  }
}
