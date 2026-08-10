import type { TranslatableErrorCode, TrpcResponse } from "~/server/api/contract";
import { toErrorCode } from "~/lib/trpc-errors";

/**
 * Discriminated view of a react-query result carrying a `TrpcResponse`.
 *
 * A domain failure is not an empty payload: `data` is only exposed when the
 * envelope reports no error, and transport failures (role guards, network) are
 * mapped to the same stable code space so the UI has a single error channel.
 */
export type EnvelopeState<TResult> =
  | { status: "pending" }
  | { status: "error"; code: TranslatableErrorCode }
  | { status: "success"; data: TResult };

type QueryLike<TResult> = {
  data: TrpcResponse<TResult, TranslatableErrorCode> | undefined;
  error: unknown;
  isPending: boolean;
};

export function unwrapEnvelope<TResult>(
  query: QueryLike<TResult>,
): EnvelopeState<TResult> {
  if (query.isPending) {
    return { status: "pending" };
  }

  if (query.error) {
    return { status: "error", code: toErrorCode(query.error) };
  }

  const response = query.data;

  if (response?.error != null || response?.result == null) {
    return {
      status: "error",
      code: response?.error ?? "UNKNOWN_ERROR",
    };
  }

  return { status: "success", data: response.result };
}
