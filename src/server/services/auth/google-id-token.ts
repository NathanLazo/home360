import "server-only";

import { createPublicKey, verify as verifySignature } from "node:crypto";
import { z } from "zod";

import { env } from "~/env";

const GOOGLE_JWKS_URL = "https://www.googleapis.com/oauth2/v3/certs";
const GOOGLE_ISSUERS = ["https://accounts.google.com", "accounts.google.com"];
const JWKS_CACHE_TTL_MS = 60 * 60 * 1_000;
const CLOCK_TOLERANCE_MS = 15_000;

const jwkSchema = z.object({
  kty: z.literal("RSA"),
  kid: z.string(),
  n: z.string(),
  e: z.string(),
});

const jwksSchema = z.object({ keys: z.array(jwkSchema.passthrough()) });

const headerSchema = z.object({
  alg: z.literal("RS256"),
  kid: z.string(),
});

const payloadSchema = z.object({
  iss: z.string(),
  aud: z.string(),
  exp: z.number(),
  email: z.string().trim().toLowerCase().email(),
  email_verified: z.boolean(),
});

type GoogleJwk = z.infer<typeof jwkSchema>;

let jwksCache: { keys: GoogleJwk[]; fetchedAtMs: number } | undefined;

async function getGoogleJwks(forceRefresh: boolean): Promise<GoogleJwk[]> {
  const now = Date.now();

  if (
    !forceRefresh &&
    jwksCache &&
    now - jwksCache.fetchedAtMs < JWKS_CACHE_TTL_MS
  ) {
    return jwksCache.keys;
  }

  const response = await fetch(GOOGLE_JWKS_URL, { cache: "no-store" });

  if (!response.ok) {
    throw new Error("Failed to fetch Google JWKS");
  }

  const keys = jwksSchema.parse(await response.json()).keys;
  jwksCache = { keys, fetchedAtMs: now };

  return keys;
}

async function findGoogleJwk(kid: string): Promise<GoogleJwk | null> {
  const cachedKeys = await getGoogleJwks(false);
  const cachedMatch = cachedKeys.find((key) => key.kid === kid);

  if (cachedMatch) {
    return cachedMatch;
  }

  // Key rotation: the kid may belong to a key published after our cache.
  const freshKeys = await getGoogleJwks(true);

  return freshKeys.find((key) => key.kid === kid) ?? null;
}

function parseJwtSegment(segment: string): unknown {
  return JSON.parse(Buffer.from(segment, "base64url").toString("utf8"));
}

export type VerifiedGoogleIdToken = {
  email: string;
};

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
    const segments = idToken.split(".");

    if (segments.length !== 3) {
      return null;
    }

    const [encodedHeader, encodedPayload, encodedSignature] = segments as [
      string,
      string,
      string,
    ];

    const header = headerSchema
      .passthrough()
      .safeParse(parseJwtSegment(encodedHeader));

    if (!header.success) {
      return null;
    }

    const jwk = await findGoogleJwk(header.data.kid);

    if (!jwk) {
      return null;
    }

    const publicKey = createPublicKey({
      key: { kty: jwk.kty, n: jwk.n, e: jwk.e },
      format: "jwk",
    });
    const isSignatureValid = verifySignature(
      "RSA-SHA256",
      Buffer.from(`${encodedHeader}.${encodedPayload}`, "utf8"),
      publicKey,
      Buffer.from(encodedSignature, "base64url"),
    );

    if (!isSignatureValid) {
      return null;
    }

    const payload = payloadSchema
      .passthrough()
      .safeParse(parseJwtSegment(encodedPayload));

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

    return { email };
  } catch {
    return null;
  }
}
