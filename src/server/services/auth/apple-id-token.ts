import "server-only";

import { z } from "zod";

import { env } from "~/env";
import type { VerifiedSocialIdentity } from "~/server/services/auth/google-id-token";
import { verifyRs256Jwt } from "~/server/services/auth/oidc-jwt";

const APPLE_JWKS_URL = "https://appleid.apple.com/auth/keys";
const APPLE_ISSUER = "https://appleid.apple.com";
const CLOCK_TOLERANCE_MS = 15_000;

// Apple serializes `email_verified` as a boolean or as the string "true".
const appleBooleanSchema = z.union([
  z.boolean(),
  z.enum(["true", "false"]).transform((value) => value === "true"),
]);

const payloadSchema = z.object({
  iss: z.string(),
  aud: z.string(),
  exp: z.number(),
  email: z.string().trim().toLowerCase().email(),
  email_verified: appleBooleanSchema.optional(),
});

/**
 * Verifies an Apple `identityToken` from Sign in with Apple on iOS: RS256
 * signature against Apple's JWKS, issuer, audience (the iOS bundle id,
 * `AUTH_APPLE_BUNDLE_ID`), expiry and a verified email (private relay
 * addresses included). The display name is not in the token: the app sends
 * it on the first authorization and the caller passes it through.
 */
export async function verifyAppleIdentityToken(
  identityToken: string,
  name: string | null,
): Promise<VerifiedSocialIdentity | null> {
  try {
    const payload = payloadSchema
      .passthrough()
      .safeParse(await verifyRs256Jwt(identityToken, APPLE_JWKS_URL));

    if (!payload.success) {
      return null;
    }

    const {
      iss,
      aud,
      exp,
      email,
      email_verified: emailVerified,
    } = payload.data;

    if (iss !== APPLE_ISSUER || aud !== env.AUTH_APPLE_BUNDLE_ID) {
      return null;
    }

    if (exp * 1_000 <= Date.now() - CLOCK_TOLERANCE_MS) {
      return null;
    }

    // Apple only issues verified emails; reject an explicit `false` anyway.
    if (emailVerified === false) {
      return null;
    }

    return { email, name };
  } catch {
    return null;
  }
}
