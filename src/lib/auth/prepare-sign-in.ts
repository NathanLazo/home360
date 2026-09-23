export type SignInSessionIntent = "keep" | "replace";

/**
 * Runs right before `signIn()`: makes sure this browser has its httpOnly
 * device id and records the session intent (used by the Google round trip).
 * Throws when the server refuses, so callers show their generic error.
 */
export async function prepareSignIn(
  intent: SignInSessionIntent,
): Promise<void> {
  const response = await fetch("/api/auth/session-intent", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ intent }),
    cache: "no-store",
    credentials: "same-origin",
  });

  if (!response.ok) {
    throw new Error("SESSION_INTENT_FAILED");
  }
}
