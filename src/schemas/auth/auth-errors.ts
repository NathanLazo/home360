import type { ErrorCode } from "~/server/api/contract";

export const AUTH_ERROR_CODES = [
  "EMAIL_TAKEN",
  "INVALID_TOKEN",
  "TOO_MANY_REQUESTS",
] as const;

export type AuthErrorCode = ErrorCode | (typeof AUTH_ERROR_CODES)[number];
