import type { SignInResponse } from "next-auth/react";

import {
  ACTIVE_SESSION_EXISTS_CODE,
  INVALID_CREDENTIALS_CODE,
} from "~/lib/auth/session-errors";

/**
 * Where `signIn()` should say a successful credentials login lands. With
 * `redirect: false` next-auth never navigates there: it only parses the
 * `error`/`code` params of the URL the server returns, which on success is
 * this value. Leaving it unset makes it `window.location.href`, so a page
 * opened as `/login?error=SessionEnded` (session revoked from another
 * computer) reported every correct login as failed even though the cookie
 * was already set. Must stay a clean path without query params.
 */
export const CREDENTIALS_SIGN_IN_REDIRECT_TO = "/";

export type SignInOutcome =
  | "success"
  | "activeSession"
  | "invalidCredentials"
  | "unexpected";

/**
 * Maps the `signIn()` result to what the form should do. Only the default
 * `credentials` code means the email/password pair was rejected; a transient
 * backend failure (database, network) must not be disguised as that.
 */
export function classifySignInResponse(
  response: SignInResponse | undefined,
): SignInOutcome {
  if (!response) return "unexpected";
  if (response.code === ACTIVE_SESSION_EXISTS_CODE) return "activeSession";
  if (!response.error) return response.ok ? "success" : "unexpected";
  return response.code === INVALID_CREDENTIALS_CODE
    ? "invalidCredentials"
    : "unexpected";
}
