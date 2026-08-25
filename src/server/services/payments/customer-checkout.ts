import "server-only";

import {
  BranchStatus,
  OrderEventType,
  OrderStatus,
  OrderType,
  PaymentMethod,
  PaymentStatus,
  Prisma,
  ProductStatus,
  QuoteStatus,
  RequestStatus,
  type PrismaClient,
} from "../../../../generated/prisma";
import Stripe from "stripe";

import {
  commissionCentsOnPrincipal,
  resolveCommissionPct,
} from "~/server/services/payments/commission-resolution";
import {
  svcFail,
  svcOk,
  type ServiceResult,
} from "~/server/services/service-result";
import { sendLocalizedPushToUser } from "~/server/services/push/messages";

const MAX_PRISMA_INT = 2_147_483_647;
const MILLISECONDS_PER_HOUR = 60 * 60 * 1_000;
const STRIPE_API_VERSION = "2026-07-29.dahlia" as const;

export type CustomerCheckoutDeps = {
  db: PrismaClient;
  stripe: Stripe;
  publishableKey: string;
};

export type CheckoutIntentResult = {
  paymentIntentClientSecret: string;
  ephemeralKeySecret: string;
  customerId: string;
  publishableKey: string;
  totalCents: number;
};

export type SavedPaymentMethod = {
  id: string;
  brand: string;
  last4: string;
};

type CheckoutErrorCode = "BUSINESS_NOT_ACTIVE";

function isStripeError(error: unknown): error is Stripe.errors.StripeError {
  return error instanceof Stripe.errors.StripeError;
}

function expandableId(
  value: string | { id: string } | null | undefined,
): string | null {
  return typeof value === "string" ? value : (value?.id ?? null);
}

async function ensureCustomerStripeCustomer(
  deps: Pick<CustomerCheckoutDeps, "db" | "stripe">,
  customerId: string,
): Promise<ServiceResult<{ stripeCustomerId: string }>> {
  const customer = await deps.db.user.findUnique({
    where: { id: customerId },
    select: {
      id: true,
      name: true,
      email: true,
      customerProfile: { select: { stripeCustomerId: true } },
    },
  });

  if (!customer) {
    return svcFail("NOT_FOUND", "Customer not found");
  }

  if (customer.customerProfile?.stripeCustomerId) {
    return svcOk({
      stripeCustomerId: customer.customerProfile.stripeCustomerId,
    });
  }

  try {
    const stripeCustomer = await deps.stripe.customers.create(
      {
        name: customer.name ?? undefined,
        email: customer.email ?? undefined,
        metadata: { customerId: customer.id },
      },
      { idempotencyKey: `customer-checkout-${customer.id}` },
    );

    const profile = await deps.db.customerProfile.upsert({
      where: { userId: customer.id },
      create: { userId: customer.id, stripeCustomerId: stripeCustomer.id },
      update: { stripeCustomerId: stripeCustomer.id },
      select: { stripeCustomerId: true },
    });

    if (!profile.stripeCustomerId) {
      return svcFail("CONFLICT", "Customer lost its Stripe customer");
    }

    return svcOk({ stripeCustomerId: profile.stripeCustomerId });
  } catch (error) {
    if (isStripeError(error)) {
      return svcFail("STRIPE_ERROR", "Stripe customer creation failed");
    }

    throw error;
  }
}

type CheckoutOrder = {
  id: string;
  type: OrderType;
  title: string;
  status: OrderStatus;
  amountCents: number;
  customerId: string;
  businessId: string;
  corporateAccountId: string | null;
  payment: {
    id: string;
    status: PaymentStatus;
    amountCents: number;
    stripePaymentIntentId: string | null;
  } | null;
};

async function getReusablePaymentIntent(
  deps: CustomerCheckoutDeps,
  order: CheckoutOrder,
  stripeCustomerId: string,
): Promise<ServiceResult<Stripe.PaymentIntent> | null> {
  if (!order.payment) {
    return null;
  }

  if (
    order.payment.status !== PaymentStatus.PENDING ||
    order.payment.stripePaymentIntentId === null
  ) {
    return svcFail("CONFLICT", "Order already has a non-retryable payment");
  }

  try {
    const paymentIntent = await deps.stripe.paymentIntents.retrieve(
      order.payment.stripePaymentIntentId,
    );

    if (
      paymentIntent.status === "canceled" ||
      paymentIntent.amount !== order.payment.amountCents ||
      paymentIntent.currency !== "mxn" ||
      expandableId(paymentIntent.customer) !== stripeCustomerId
    ) {
      return svcFail("CONFLICT", "Stored payment intent is not reusable");
    }

    return svcOk(paymentIntent);
  } catch (error) {
    if (isStripeError(error)) {
      return svcFail("STRIPE_ERROR", "Payment intent retrieval failed");
    }

    throw error;
  }
}

async function createOrderPaymentIntent(
  deps: CustomerCheckoutDeps,
  input: {
    customerId: string;
    orderId: string;
    expectedType: OrderType;
  },
): Promise<ServiceResult<CheckoutIntentResult, CheckoutErrorCode>> {
  if (deps.publishableKey.trim().length === 0) {
    return svcFail("STRIPE_ERROR", "Stripe publishable key is not configured");
  }

  const order = await deps.db.order.findFirst({
    where: {
      id: input.orderId,
      customerId: input.customerId,
      type: input.expectedType,
    },
    select: {
      id: true,
      type: true,
      title: true,
      status: true,
      amountCents: true,
      customerId: true,
      businessId: true,
      corporateAccountId: true,
      payment: {
        select: {
          id: true,
          status: true,
          amountCents: true,
          stripePaymentIntentId: true,
        },
      },
    },
  });

  if (!order) {
    return svcFail("NOT_FOUND", "Order not found");
  }

  if (order.status !== OrderStatus.PENDING) {
    return svcFail("CONFLICT", "Order is not pending payment");
  }

  const customer = await ensureCustomerStripeCustomer(deps, input.customerId);

  if (!customer.ok) {
    return customer;
  }

  let paymentIntent: Stripe.PaymentIntent;
  const reusable = await getReusablePaymentIntent(
    deps,
    order,
    customer.data.stripeCustomerId,
  );

  if (reusable !== null) {
    if (!reusable.ok) {
      return reusable;
    }

    paymentIntent = reusable.data;
  } else {
    const settings = await deps.db.platformSettings.findUnique({
      where: { id: 1 },
      select: { customerServiceFeeCents: true },
    });

    if (!settings) {
      return svcFail("CONFLICT", "Platform settings are not configured");
    }

    const totalCents = order.amountCents + settings.customerServiceFeeCents;

    if (
      !Number.isSafeInteger(order.amountCents) ||
      order.amountCents <= 0 ||
      !Number.isSafeInteger(settings.customerServiceFeeCents) ||
      settings.customerServiceFeeCents < 0 ||
      !Number.isSafeInteger(totalCents) ||
      totalCents > MAX_PRISMA_INT
    ) {
      return svcFail("CONFLICT", "Invalid checkout amount configuration");
    }

    const commission = await resolveCommissionPct(deps.db, {
      businessId: order.businessId,
      corporateAccountId: order.corporateAccountId,
    });

    if (!commission.ok) {
      return svcFail(commission.code, commission.detail);
    }

    const metadata = {
      orderId: order.id,
      businessId: order.businessId,
      customerId: input.customerId,
      providerAmountCents: String(order.amountCents),
      checkoutType: order.type,
    };

    try {
      paymentIntent = await deps.stripe.paymentIntents.create(
        {
          amount: totalCents,
          currency: "mxn",
          customer: customer.data.stripeCustomerId,
          automatic_payment_methods: { enabled: true },
          setup_future_usage: "off_session",
          description: order.title,
          metadata,
        },
        { idempotencyKey: `customer-checkout-order-${order.id}` },
      );
    } catch (error) {
      if (isStripeError(error)) {
        return svcFail("STRIPE_ERROR", "Payment intent creation failed");
      }

      throw error;
    }

    const commissionCents = commissionCentsOnPrincipal(
      order.amountCents,
      commission.data.effectivePct,
    );
    const providerPlanCommissionCents = commissionCentsOnPrincipal(
      order.amountCents,
      commission.data.providerPlanPct,
    );

    try {
      await deps.db.payment.create({
        data: {
          orderId: order.id,
          businessId: order.businessId,
          method: PaymentMethod.CARD,
          status: PaymentStatus.PENDING,
          amountCents: totalCents,
          providerAmountCents: order.amountCents,
          serviceFeeCentsApplied: settings.customerServiceFeeCents,
          commissionPctApplied: commission.data.effectivePct,
          commissionCents,
          providerPlanCommissionPctApplied: commission.data.providerPlanPct,
          providerPlanCommissionCents,
          commissionSource: commission.data.source,
          stripePaymentIntentId: paymentIntent.id,
        },
      });
    } catch (error) {
      if (!(
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      )) {
        throw error;
      }

      const concurrent = await deps.db.payment.findUnique({
        where: { orderId: order.id },
        select: { stripePaymentIntentId: true, status: true },
      });

      if (
        concurrent?.status !== PaymentStatus.PENDING ||
        concurrent.stripePaymentIntentId !== paymentIntent.id
      ) {
        return svcFail("CONFLICT", "Order payment was created concurrently");
      }
    }
  }

  if (paymentIntent.client_secret === null) {
    return svcFail("STRIPE_ERROR", "Payment intent has no client secret");
  }

  try {
    const ephemeralKey = await deps.stripe.ephemeralKeys.create(
      { customer: customer.data.stripeCustomerId },
      { apiVersion: STRIPE_API_VERSION },
    );

    if (!ephemeralKey.secret) {
      return svcFail("STRIPE_ERROR", "Ephemeral key has no secret");
    }

    return svcOk({
      paymentIntentClientSecret: paymentIntent.client_secret,
      ephemeralKeySecret: ephemeralKey.secret,
      customerId: customer.data.stripeCustomerId,
      publishableKey: deps.publishableKey,
      totalCents: paymentIntent.amount,
    });
  } catch (error) {
    if (isStripeError(error)) {
      return svcFail("STRIPE_ERROR", "Ephemeral key creation failed");
    }

    throw error;
  }
}

export async function createServiceCheckoutIntent(
  deps: CustomerCheckoutDeps,
  input: { customerId: string; orderId: string },
): Promise<ServiceResult<CheckoutIntentResult, CheckoutErrorCode>> {
  return createOrderPaymentIntent(deps, {
    ...input,
    expectedType: OrderType.SERVICE,
  });
}

export async function createProductCheckoutIntent(
  deps: CustomerCheckoutDeps,
  input: {
    customerId: string;
    productId: string;
    quantity: number;
    addressId: string;
  },
): Promise<ServiceResult<CheckoutIntentResult, CheckoutErrorCode>> {
  const [address, product] = await Promise.all([
    deps.db.address.findFirst({
      where: { id: input.addressId, userId: input.customerId },
      select: { addressLine: true, latitude: true, longitude: true },
    }),
    deps.db.product.findFirst({
      where: {
        id: input.productId,
        status: ProductStatus.PUBLISHED,
        business: { status: "ACTIVE" },
      },
      select: {
        id: true,
        name: true,
        priceCents: true,
        businessId: true,
      },
    }),
  ]);

  if (!address || !product) {
    return svcFail("NOT_FOUND", "Product or address not found");
  }

  const branch = await deps.db.branch.findFirst({
    where: { businessId: product.businessId, status: BranchStatus.ACTIVE },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: { id: true },
  });

  if (!branch) {
    return svcFail("CONFLICT", "Business has no active branch");
  }

  const stock = await deps.db.productStock.findUnique({
    where: {
      productId_branchId: { productId: product.id, branchId: branch.id },
    },
    select: { stock: true },
  });

  if (!stock || stock.stock < input.quantity) {
    return svcFail("CONFLICT", "Product stock is insufficient");
  }

  const providerAmountCents = product.priceCents * input.quantity;

  if (
    !Number.isSafeInteger(providerAmountCents) ||
    providerAmountCents <= 0 ||
    providerAmountCents > MAX_PRISMA_INT
  ) {
    return svcFail("CONFLICT", "Invalid product checkout amount");
  }

  const order = await deps.db.order.create({
    data: {
      type: OrderType.PRODUCT,
      title: product.name,
      status: OrderStatus.PENDING,
      amountCents: providerAmountCents,
      customerId: input.customerId,
      businessId: product.businessId,
      branchId: branch.id,
      productId: product.id,
      quantity: input.quantity,
      deliveryAddressLine: address.addressLine,
      deliveryLatitude: address.latitude,
      deliveryLongitude: address.longitude,
    },
    select: { id: true },
  });

  return createOrderPaymentIntent(deps, {
    customerId: input.customerId,
    orderId: order.id,
    expectedType: OrderType.PRODUCT,
  });
}

export async function listCustomerPaymentMethods(
  deps: Pick<CustomerCheckoutDeps, "db" | "stripe">,
  input: { customerId: string },
): Promise<ServiceResult<SavedPaymentMethod[]>> {
  const customer = await ensureCustomerStripeCustomer(deps, input.customerId);

  if (!customer.ok) {
    return customer;
  }

  try {
    const methods = await deps.stripe.paymentMethods.list({
      customer: customer.data.stripeCustomerId,
      type: "card",
      limit: 100,
    });

    return svcOk(
      methods.data.flatMap((method) =>
        method.card
          ? [
              {
                id: method.id,
                brand: method.card.brand,
                last4: method.card.last4,
              },
            ]
          : [],
      ),
    );
  } catch (error) {
    if (isStripeError(error)) {
      return svcFail("STRIPE_ERROR", "Payment method listing failed");
    }

    throw error;
  }
}

export async function finalizePendingCheckoutPayment(
  deps: Pick<CustomerCheckoutDeps, "db">,
  input: {
    stripePaymentIntentId: string;
    stripeChargeId: string;
    amountCents: number;
  },
): Promise<ServiceResult<{ handled: boolean }>> {
  const payment = await deps.db.payment.findUnique({
    where: { stripePaymentIntentId: input.stripePaymentIntentId },
    select: {
      id: true,
      status: true,
      amountCents: true,
      stripeChargeId: true,
      order: {
        select: {
          id: true,
          status: true,
          type: true,
          quantity: true,
          productId: true,
          branchId: true,
          business: { select: { ownerId: true } },
          quote: { select: { id: true, requestId: true } },
        },
      },
    },
  });

  if (!payment) {
    return svcOk({ handled: false });
  }

  const order = payment.order;

  if (!order) {
    return svcOk({ handled: false });
  }

  if (payment.amountCents !== input.amountCents) {
    return svcFail("CONFLICT", "Payment amount does not match checkout");
  }

  if (payment.status === PaymentStatus.IN_ESCROW) {
    return payment.stripeChargeId === input.stripeChargeId
      ? svcOk({ handled: true })
      : svcFail("CONFLICT", "Checkout was captured by another charge");
  }

  if (
    payment.status !== PaymentStatus.PENDING ||
    order.status !== OrderStatus.PENDING
  ) {
    return svcFail("CONFLICT", "Checkout is not pending");
  }

  const settings = await deps.db.platformSettings.findUnique({
    where: { id: 1 },
    select: { escrowAutoReleaseHours: true },
  });

  if (
    !settings ||
    !Number.isInteger(settings.escrowAutoReleaseHours) ||
    settings.escrowAutoReleaseHours < 0
  ) {
    return svcFail("CONFLICT", "Invalid escrow release configuration");
  }

  let shouldNotifyBusiness = false;
  const result = await deps.db.$transaction(async (tx) => {
    const captured = await tx.payment.updateMany({
      where: {
        id: payment.id,
        status: PaymentStatus.PENDING,
        stripePaymentIntentId: input.stripePaymentIntentId,
        stripeChargeId: null,
      },
      data: {
        status: PaymentStatus.IN_ESCROW,
        stripeChargeId: input.stripeChargeId,
        escrowReleaseAt: new Date(
          Date.now() + settings.escrowAutoReleaseHours * MILLISECONDS_PER_HOUR,
        ),
      },
    });

    if (captured.count === 0) {
      const current = await tx.payment.findUnique({
        where: { id: payment.id },
        select: { status: true, stripeChargeId: true },
      });

      return current?.status === PaymentStatus.IN_ESCROW &&
        current.stripeChargeId === input.stripeChargeId
        ? svcOk({ handled: true })
        : svcFail("CONFLICT", "Checkout capture claim was lost");
    }

    shouldNotifyBusiness = true;

    await tx.order.update({
      where: { id: order.id },
      data: { status: OrderStatus.PAID },
    });

    const heldEvent = await tx.orderEvent.findFirst({
      where: {
        orderId: order.id,
        type: OrderEventType.ESCROW_HELD,
      },
      select: { id: true },
    });

    if (!heldEvent) {
      await tx.orderEvent.create({
        data: {
          orderId: order.id,
          type: OrderEventType.ESCROW_HELD,
        },
      });
    }

    if (order.quote) {
      await tx.quote.update({
        where: { id: order.quote.id },
        data: { status: QuoteStatus.ACCEPTED },
      });
      await tx.quote.updateMany({
        where: {
          requestId: order.quote.requestId,
          id: { not: order.quote.id },
          status: QuoteStatus.PENDING,
        },
        data: { status: QuoteStatus.EXPIRED },
      });
      await tx.serviceRequest.update({
        where: { id: order.quote.requestId },
        data: { status: RequestStatus.ACCEPTED },
      });
    }

    if (
      order.type === OrderType.PRODUCT &&
      order.productId !== null &&
      order.branchId !== null
    ) {
      await tx.productStock.update({
        where: {
          productId_branchId: {
            productId: order.productId,
            branchId: order.branchId,
          },
        },
        data: { stock: { decrement: order.quantity } },
      });
    }

    return svcOk({ handled: true });
  });

  if (result.ok && shouldNotifyBusiness) {
    await sendLocalizedPushToUser(deps.db, order.business.ownerId, {
      message: "escrowHeld",
      url: `home360app://orders/${order.id}`,
    });
  }

  return result;
}
