import { TRPCClientError } from "@trpc/client";

import { IMPERSONATION_READ_ONLY } from "~/lib/auth/impersonation";
import type { ErrorCode } from "~/server/api/contract";

const getTransportCode = (error: unknown): unknown => {
  if (typeof error !== "object" || error === null || !("data" in error)) {
    return undefined;
  }

  const data: unknown = error.data;

  if (typeof data !== "object" || data === null || !("code" in data)) {
    return undefined;
  }

  return data.code;
};

/** Maps transport-level tRPC errors thrown by role guards to contract codes. */
export function toErrorCode(error: unknown): ErrorCode {
  if (error instanceof TRPCClientError) {
    const code = getTransportCode(error);

    if (code === "UNAUTHORIZED") {
      return "UNAUTHORIZED";
    }

    if (code === "FORBIDDEN") {
      return error.message === IMPERSONATION_READ_ONLY
        ? "IMPERSONATION_READ_ONLY"
        : "FORBIDDEN";
    }
  }

  return "UNKNOWN_ERROR";
}
