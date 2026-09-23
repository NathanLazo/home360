import { Prisma } from "@generated/prisma";

/**
 * Stable error codes shared by every tRPC procedure.
 *
 * `message` is short English reference text for logs and debugging. The UI must
 * always translate errors from `error` using `errors.json`.
 */
export const ERROR_CODES = [
  "UNAUTHORIZED",
  "FORBIDDEN",
  "NOT_FOUND",
  "VALIDATION_ERROR",
  "CONFLICT",
  "PLAN_LIMIT_REACHED",
  "BUSINESS_NOT_ACTIVE",
  "INSUFFICIENT_BALANCE",
  "STRIPE_ERROR",
  "INTERNAL_ERROR",
  "UNKNOWN_ERROR",
  "INVALID_TOKEN",
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

/**
 * Domain codes raised by the money, dispute and settings services (F3/F5).
 * They are kept out of `ERROR_CODES` so exhaustive maps over the base contract
 * stay valid, but every value must exist in `errors.json` because the UI
 * translates them through the same channel.
 */
export const DOMAIN_ERROR_CODES = [
  "NO_CONNECT_ACCOUNT",
  "PAYMENT_NOT_RELEASABLE",
  "PAYMENT_NOT_REFUNDABLE",
  "REFUND_EXCEEDS_LIMIT",
  "DISPUTE_OPEN",
  "RECORDING_JUSTIFICATION_REQUIRED",
  "WITHDRAWAL_NOT_PENDING",
  "BUSINESS_SUSPENDED",
  "SETTINGS_STALE",
  "AI_UNAVAILABLE",
  "ADDRESS_LIMIT_REACHED",
  // Payment router codes (already translated in errors.json).
  "ORDER_NOT_FOUND",
  "INVALID_TARGET",
  "CORPORATE_PRICING_NOT_AVAILABLE",
] as const;

export type DomainErrorCode = (typeof DOMAIN_ERROR_CODES)[number];

/** Every code the UI may need to translate. */
export type TranslatableErrorCode = ErrorCode | DomainErrorCode;

export type TrpcResponse<TResult, TError extends string = ErrorCode> = {
  result: TResult | null;
  error: TError | ErrorCode | null;
  status: number;
  message: string;
};

export const ok = <T>(
  result: T,
  message: string,
  status = 200,
): TrpcResponse<T> => ({
  result,
  error: null,
  status,
  message,
});

export const fail = <T = never, E extends string = ErrorCode>(
  error: E | ErrorCode,
  status: number,
  message: string,
): TrpcResponse<T, E> => ({
  result: null,
  error,
  status,
  message,
});

const isStripeError = (error: unknown): boolean => {
  if (typeof error !== "object" || error === null || !("type" in error)) {
    return false;
  }

  return typeof error.type === "string" && error.type.startsWith("Stripe");
};

/**
 * Converts infrastructure errors into stable, client-safe contract metadata.
 * Original messages and stacks are intentionally never exposed.
 */
export function normalizeError(error: unknown): {
  code: ErrorCode;
  status: number;
} {
  try {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        return { code: "CONFLICT", status: 409 };
      }

      if (error.code === "P2025") {
        return { code: "NOT_FOUND", status: 404 };
      }

      return { code: "INTERNAL_ERROR", status: 500 };
    }

    if (isStripeError(error)) {
      return { code: "STRIPE_ERROR", status: 502 };
    }

    return { code: "UNKNOWN_ERROR", status: 500 };
  } catch {
    return { code: "UNKNOWN_ERROR", status: 500 };
  }
}
