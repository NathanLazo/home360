import "server-only";

import { createPublicKey, verify as verifySignature } from "node:crypto";
import { z } from "zod";

const JWKS_CACHE_TTL_MS = 60 * 60 * 1_000;

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

type RsaJwk = z.infer<typeof jwkSchema>;

const jwksCache = new Map<string, { keys: RsaJwk[]; fetchedAtMs: number }>();

async function getJwks(
  jwksUrl: string,
  forceRefresh: boolean,
): Promise<RsaJwk[]> {
  const now = Date.now();
  const cached = jwksCache.get(jwksUrl);

  if (!forceRefresh && cached && now - cached.fetchedAtMs < JWKS_CACHE_TTL_MS) {
    return cached.keys;
  }

  const response = await fetch(jwksUrl, { cache: "no-store" });

  if (!response.ok) {
    throw new Error("Failed to fetch JWKS");
  }

  const keys = jwksSchema.parse(await response.json()).keys;
  jwksCache.set(jwksUrl, { keys, fetchedAtMs: now });

  return keys;
}

async function findJwk(jwksUrl: string, kid: string): Promise<RsaJwk | null> {
  const cachedMatch = (await getJwks(jwksUrl, false)).find(
    (key) => key.kid === kid,
  );

  if (cachedMatch) {
    return cachedMatch;
  }

  // Key rotation: the kid may belong to a key published after our cache.
  return (await getJwks(jwksUrl, true)).find((key) => key.kid === kid) ?? null;
}

function parseJwtSegment(segment: string): unknown {
  return JSON.parse(Buffer.from(segment, "base64url").toString("utf8"));
}

/**
 * Verifies the RS256 signature of an OIDC `id_token` against the provider's
 * JWKS (cached 1 h, refreshed on unknown `kid`). Returns the decoded payload
 * for the caller to validate claims, or `null` for any malformed or
 * unsigned token. Throws only when the JWKS endpoint is unreachable.
 */
export async function verifyRs256Jwt(
  idToken: string,
  jwksUrl: string,
): Promise<unknown> {
  const segments = idToken.split(".");

  if (segments.length !== 3) {
    return null;
  }

  const [encodedHeader, encodedPayload, encodedSignature] = segments as [
    string,
    string,
    string,
  ];

  let rawHeader: unknown;
  let rawPayload: unknown;

  try {
    rawHeader = parseJwtSegment(encodedHeader);
    rawPayload = parseJwtSegment(encodedPayload);
  } catch {
    return null;
  }

  const header = headerSchema.passthrough().safeParse(rawHeader);

  if (!header.success) {
    return null;
  }

  const jwk = await findJwk(jwksUrl, header.data.kid);

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

  return isSignatureValid ? rawPayload : null;
}
