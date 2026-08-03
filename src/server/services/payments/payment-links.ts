import "server-only";

import {
  PaymentLinkStatus,
  type PrismaClient,
} from "../../../../generated/prisma";
import Stripe from "stripe";

import {
  svcFail,
  svcOk,
  type ServiceResult,
} from "~/server/services/service-result";

const MAX_PRISMA_INT = 2_147_483_647;

export type PaymentLinkServiceDeps = {
  db: PrismaClient;
  stripe: Stripe;
};

export type CreatePaymentLinkInput = {
  businessId: string;
  concept: string;
  providerAmountCents: number;
  locale: "es" | "en";
  baseUrl: string;
};

export type ReconcilePaymentLinkInput = {
  businessId: string;
  paymentLinkId: string;
  locale: "es" | "en";
  baseUrl: string;
};

type PaymentLinkResult = { paymentLinkId: string; url: string };

type CreatingPaymentLink = {
  id: string;
  businessId: string;
  concept: string;
  amountCents: number;
};

function isStripeError(error: unknown): error is Stripe.errors.StripeError {
  return error instanceof Stripe.errors.StripeError;
}

function isValidBaseUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

function hasValidCreateInput(input: CreatePaymentLinkInput): boolean {
  return (
    input.businessId.trim().length > 0 &&
    input.concept.trim().length > 0 &&
    Number.isSafeInteger(input.providerAmountCents) &&
    input.providerAmountCents > 0 &&
    input.providerAmountCents <= MAX_PRISMA_INT &&
    isValidBaseUrl(input.baseUrl)
  );
}

function successUrl(baseUrl: string, locale: "es" | "en"): string {
  return `${baseUrl.replace(/\/$/, "")}/${locale}/pay/success`;
}

async function publishPaymentLink(
  { db, stripe }: PaymentLinkServiceDeps,
  paymentLink: CreatingPaymentLink,
  input: { locale: "es" | "en"; baseUrl: string },
): Promise<ServiceResult<PaymentLinkResult>> {
  const settings = await db.platformSettings.findUnique({
    where: { id: 1 },
    select: { customerServiceFeeCents: true },
  });

  if (!settings) {
    return svcFail("CONFLICT", "Platform settings are not configured");
  }

  const serviceFeeCentsApplied = settings.customerServiceFeeCents;
  const totalCents = paymentLink.amountCents + serviceFeeCentsApplied;

  if (
    !Number.isSafeInteger(serviceFeeCentsApplied) ||
    serviceFeeCentsApplied < 0 ||
    !Number.isSafeInteger(totalCents) ||
    totalCents <= 0 ||
    totalCents > MAX_PRISMA_INT
  ) {
    return svcFail("CONFLICT", "Invalid customer service fee configuration");
  }

  const metadata = {
    paymentLinkId: paymentLink.id,
    businessId: paymentLink.businessId,
    providerAmountCents: String(paymentLink.amountCents),
    serviceFeeCentsApplied: String(serviceFeeCentsApplied),
  };
  let stripePaymentLink: Stripe.PaymentLink;

  try {
    stripePaymentLink = await stripe.paymentLinks.create(
      {
        line_items: [
          {
            price_data: {
              currency: "mxn",
              unit_amount: totalCents,
              product_data: { name: paymentLink.concept },
            },
            quantity: 1,
          },
        ],
        metadata,
        payment_intent_data: { metadata },
        restrictions: { completed_sessions: { limit: 1 } },
        after_completion: {
          type: "redirect",
          redirect: { url: successUrl(input.baseUrl, input.locale) },
        },
      },
      { idempotencyKey: `payment-link-${paymentLink.id}` },
    );
  } catch (error) {
    if (isStripeError(error)) {
      return svcFail("STRIPE_ERROR");
    }

    throw error;
  }

  const publication = await db.paymentLink.updateMany({
    where: {
      id: paymentLink.id,
      businessId: paymentLink.businessId,
      status: PaymentLinkStatus.CREATING,
      stripePaymentLinkId: null,
      stripeUrl: null,
    },
    data: {
      stripePaymentLinkId: stripePaymentLink.id,
      stripeUrl: stripePaymentLink.url,
      status: PaymentLinkStatus.ACTIVE,
    },
  });

  if (publication.count === 1) {
    return svcOk({
      paymentLinkId: paymentLink.id,
      url: stripePaymentLink.url,
    });
  }

  const current = await db.paymentLink.findFirst({
    where: { id: paymentLink.id, businessId: paymentLink.businessId },
    select: {
      status: true,
      stripePaymentLinkId: true,
      stripeUrl: true,
    },
  });

  if (!current) {
    return svcFail("NOT_FOUND");
  }

  if (
    current.status === PaymentLinkStatus.ACTIVE &&
    current.stripePaymentLinkId === stripePaymentLink.id &&
    current.stripeUrl !== null
  ) {
    return svcOk({ paymentLinkId: paymentLink.id, url: current.stripeUrl });
  }

  return svcFail("CONFLICT");
}

export async function createPaymentLink(
  deps: PaymentLinkServiceDeps,
  input: CreatePaymentLinkInput,
): Promise<ServiceResult<PaymentLinkResult>> {
  if (!hasValidCreateInput(input)) {
    return svcFail("CONFLICT", "Invalid payment link input");
  }

  const [business, settings] = await Promise.all([
    deps.db.business.findUnique({
      where: { id: input.businessId },
      select: { id: true },
    }),
    deps.db.platformSettings.findUnique({
      where: { id: 1 },
      select: { customerServiceFeeCents: true },
    }),
  ]);

  if (!business) {
    return svcFail("NOT_FOUND");
  }

  if (!settings) {
    return svcFail("CONFLICT", "Platform settings are not configured");
  }

  if (
    !Number.isSafeInteger(settings.customerServiceFeeCents) ||
    settings.customerServiceFeeCents < 0 ||
    input.providerAmountCents + settings.customerServiceFeeCents >
      MAX_PRISMA_INT
  ) {
    return svcFail("CONFLICT", "Invalid customer service fee configuration");
  }

  const paymentLink = await deps.db.paymentLink.create({
    data: {
      businessId: input.businessId,
      concept: input.concept,
      amountCents: input.providerAmountCents,
      status: PaymentLinkStatus.CREATING,
      stripeUrl: null,
    },
    select: {
      id: true,
      businessId: true,
      concept: true,
      amountCents: true,
    },
  });

  return publishPaymentLink(deps, paymentLink, input);
}

export async function reconcilePaymentLink(
  deps: PaymentLinkServiceDeps,
  input: ReconcilePaymentLinkInput,
): Promise<ServiceResult<PaymentLinkResult>> {
  if (
    input.businessId.trim().length === 0 ||
    input.paymentLinkId.trim().length === 0 ||
    !isValidBaseUrl(input.baseUrl)
  ) {
    return svcFail("CONFLICT", "Invalid payment link reconciliation input");
  }

  const paymentLink = await deps.db.paymentLink.findFirst({
    where: { id: input.paymentLinkId, businessId: input.businessId },
    select: {
      id: true,
      businessId: true,
      concept: true,
      amountCents: true,
      status: true,
      stripePaymentLinkId: true,
      stripeUrl: true,
    },
  });

  if (!paymentLink) {
    return svcFail("NOT_FOUND");
  }

  if (
    paymentLink.status === PaymentLinkStatus.ACTIVE &&
    paymentLink.stripePaymentLinkId !== null &&
    paymentLink.stripeUrl !== null
  ) {
    return svcOk({ paymentLinkId: paymentLink.id, url: paymentLink.stripeUrl });
  }

  if (
    paymentLink.status !== PaymentLinkStatus.CREATING ||
    paymentLink.stripePaymentLinkId !== null ||
    paymentLink.stripeUrl !== null
  ) {
    return svcFail("CONFLICT");
  }

  return publishPaymentLink(deps, paymentLink, input);
}
