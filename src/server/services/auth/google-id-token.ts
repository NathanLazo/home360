import "server-only";

import { z } from "zod";

import { env } from "~/env";
import { verifyRs256Jwt } from "~/server/services/auth/oidc-jwt";

const GOOGLE_JWKS_URL = "https://www.googleapis.com/oauth2/v3/certs";
const GOOGLE_ISSUERS = ["https://accounts.google.com", "accounts.google.com"];
const CLOCK_TOLERANCE_MS = 15_000;

const payloadSchema = z.object({
  iss: z.string(),
  aud: z.string(),
  exp: z.number(),
  email: z.string().trim().toLowerCase().email(),
  email_verified: z.boolean(),
  name: z.string().trim().min(1).max(200).optional(),
});

/** Identity proven by a social provider, used by the mobile sign-in. */
export type VerifiedSocialIdentity = {
  email: string;
  /** Display name, used only to seed a new CUSTOMER account. */
  name: string | null;
};

export type VerifiedGoogleIdToken = VerifiedSocialIdentity;

/**
 * Verifies a Google-issued OIDC `id_token` for the mobile sign-in flow:
 * RS256 signature against Google's JWKS, issuer, audience (`AUTH_GOOGLE_ID`),
 * expiry and `email_verified === true`.
 *
 * Returns the normalized email, or `null` for any invalid token.
 */
export async function verifyGoogleIdToken(
  idToken: string,
): Promise<VerifiedGoogleIdToken | null> {
  try {
    const payload = payloadSchema
      .passthrough()
      .safeParse(await verifyRs256Jwt(idToken, GOOGLE_JWKS_URL));

    if (!payload.success) {
      return null;
    }

    const {
      iss,
      aud,
      exp,
      email,
      email_verified: emailVerified,
      name,
    } = payload.data;

    if (!GOOGLE_ISSUERS.includes(iss)) {
      return null;
    }

    if (aud !== env.AUTH_GOOGLE_ID) {
      return null;
    }

    if (exp * 1_000 <= Date.now() - CLOCK_TOLERANCE_MS) {
      return null;
    }

    if (emailVerified !== true) {
      return null;
    }

    return { email, name: name ?? null };
  } catch {
    return null;
  }
}
