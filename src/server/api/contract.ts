import { Prisma } from "../../../generated/prisma";

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
