/**
 * Stable codes shared by the server auth flow and the login page.
 *
 * - `ACTIVE_SESSION_EXISTS_CODE`: `code` of the `CredentialsSignin` error
 *   raised when the account is open on another computer. Credentials receive
 *   it from `signIn()`; Google lands on `/login?error=CredentialsSignin&code=…`.
 * - `SESSION_ENDED_ERROR`: `error` query param the session guard appends when
 *   a live screen discovers its session was revoked.
 */
export const ACTIVE_SESSION_EXISTS_CODE = "active_session_exists";
export const SESSION_ENDED_ERROR = "SessionEnded";
