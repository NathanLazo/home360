import "server-only";

import Stripe from "stripe";

import type { PrismaClient } from "@generated/prisma";
import {
  svcFail,
  svcOk,
  type ServiceResult,
} from "~/server/services/service-result";

export type ConnectServiceDeps = {
  db: PrismaClient;
  stripe: Stripe;
};

type BusinessInput = { businessId: string };

function isStripeError(error: unknown): error is Stripe.errors.StripeError {
  return error instanceof Stripe.errors.StripeError;
}

export async function createConnectAccount(
  { db, stripe }: ConnectServiceDeps,
  { businessId }: BusinessInput,
): Promise<ServiceResult<{ stripeAccountId: string }>> {
  const business = await db.business.findUnique({
    where: { id: businessId },
    select: { stripeAccountId: true },
  });

  if (!business) {
    return svcFail("NOT_FOUND");
  }

  if (business.stripeAccountId) {
    return svcOk({ stripeAccountId: business.stripeAccountId });
  }

  let stripeAccount: Stripe.Account;

  try {
    stripeAccount = await stripe.accounts.create(
      {
        type: "express",
        country: "MX",
        capabilities: {
          transfers: { requested: true },
          card_payments: { requested: true },
        },
        settings: {
          payouts: {
            schedule: { interval: "manual" },
          },
        },
        metadata: { businessId },
      },
      { idempotencyKey: `connect-account-${businessId}` },
    );
  } catch (error) {
    if (isStripeError(error)) {
      return svcFail("STRIPE_ERROR");
    }

    throw error;
  }

  const assignment = await db.business.updateMany({
    where: { id: businessId, stripeAccountId: null },
    data: { stripeAccountId: stripeAccount.id },
  });

  if (assignment.count === 1) {
    return svcOk({ stripeAccountId: stripeAccount.id });
  }

  const currentBusiness = await db.business.findUnique({
    where: { id: businessId },
    select: { stripeAccountId: true },
  });

  if (!currentBusiness) {
    return svcFail("NOT_FOUND");
  }

  return currentBusiness.stripeAccountId
    ? svcOk({ stripeAccountId: currentBusiness.stripeAccountId })
    : svcFail("CONFLICT");
}

export async function createOnboardingLink(
  { db, stripe }: ConnectServiceDeps,
  input: BusinessInput & { returnUrl: string; refreshUrl: string },
): Promise<ServiceResult<{ url: string }, "NO_CONNECT_ACCOUNT">> {
  const business = await db.business.findUnique({
    where: { id: input.businessId },
    select: { stripeAccountId: true },
  });

  if (!business) {
    return svcFail("NOT_FOUND");
  }

  if (!business.stripeAccountId) {
    return svcFail("NO_CONNECT_ACCOUNT");
  }

  try {
    const link = await stripe.accountLinks.create({
      account: business.stripeAccountId,
      type: "account_onboarding",
      return_url: input.returnUrl,
      refresh_url: input.refreshUrl,
    });

    return svcOk({ url: link.url });
  } catch (error) {
    if (isStripeError(error)) {
      return svcFail("STRIPE_ERROR");
    }

    throw error;
  }
}

export async function getAccountStatus(
  { db, stripe }: ConnectServiceDeps,
  { businessId }: BusinessInput,
): Promise<
  ServiceResult<
    { chargesEnabled: boolean; payoutsEnabled: boolean },
    "NO_CONNECT_ACCOUNT"
  >
> {
  const business = await db.business.findUnique({
    where: { id: businessId },
    select: {
      stripeAccountId: true,
      chargesEnabled: true,
      payoutsEnabled: true,
    },
  });

  if (!business) {
    return svcFail("NOT_FOUND");
  }

  if (!business.stripeAccountId) {
    return svcFail("NO_CONNECT_ACCOUNT");
  }

  const consultedStripeAccountId = business.stripeAccountId;
  let stripeAccount: Stripe.Account | Stripe.DeletedAccount;

  try {
    stripeAccount = await stripe.accounts.retrieve(consultedStripeAccountId);
  } catch (error) {
    if (isStripeError(error)) {
      return svcFail("STRIPE_ERROR");
    }

    throw error;
  }

  const chargesEnabled =
    "charges_enabled" in stripeAccount ? stripeAccount.charges_enabled : false;
  const payoutsEnabled =
    "payouts_enabled" in stripeAccount ? stripeAccount.payouts_enabled : false;

  if (
    business.chargesEnabled !== chargesEnabled ||
    business.payoutsEnabled !== payoutsEnabled
  ) {
    const synchronization = await db.business.updateMany({
      where: { id: businessId, stripeAccountId: consultedStripeAccountId },
      data: { chargesEnabled, payoutsEnabled },
    });

    if (synchronization.count !== 1) {
      return svcFail("CONFLICT");
    }
  } else {
    const accountIsCurrent = await db.business.findFirst({
      where: { id: businessId, stripeAccountId: consultedStripeAccountId },
      select: { id: true },
    });

    if (!accountIsCurrent) {
      return svcFail("CONFLICT");
    }
  }

  return svcOk({ chargesEnabled, payoutsEnabled });
}
