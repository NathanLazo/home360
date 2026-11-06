import { z } from "zod";

import { fail, ok, type TrpcResponse } from "~/server/api/contract";
import { issueMobileToken } from "~/server/auth/mobile-token";
import { db } from "~/server/db";
import { verifyAppleIdentityToken } from "~/server/services/auth/apple-id-token";
import { signInWithSocialIdentity } from "~/server/services/auth/social-mobile-sign-in";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE_HEADERS = { "Cache-Control": "no-store" } as const;

const bodySchema = z.object({
  identityToken: z.string().min(1),
  // Apple returns the name only on the first authorization.
  name: z.string().trim().min(1).max(200).optional(),
  // Locale of a brand-new CUSTOMER account; ignored for existing users.
  locale: z.enum(["es", "en"]).default("es"),
});

function respond<TResult>(body: TrpcResponse<TResult>): Response {
  return Response.json(body, {
    status: body.status,
    headers: NO_STORE_HEADERS,
  });
}

/**
 * Sign in with Apple for the iOS app (App Store guideline 4.8). Same
 * contract and implicit CUSTOMER sign-up as `/api/mobile/auth/google`.
 */
export async function POST(request: Request): Promise<Response> {
  try {
    let body: unknown = null;

    try {
      body = await request.json();
    } catch {
      body = null;
    }

    const parsed = bodySchema.safeParse(body);

    if (!parsed.success) {
      return respond(fail("UNAUTHORIZED", 401, "Invalid Apple token"));
    }

    const identity = await verifyAppleIdentityToken(
      parsed.data.identityToken,
      parsed.data.name ?? null,
    );

    if (!identity) {
      return respond(fail("UNAUTHORIZED", 401, "Invalid Apple token"));
    }

    const outcome = await signInWithSocialIdentity(db, {
      token: identity,
      locale: parsed.data.locale,
    });

    if (outcome.kind === "BLOCKED") {
      return respond(fail("UNAUTHORIZED", 401, "Invalid Apple token"));
    }

    const token = await issueMobileToken(outcome.user);

    return respond(
      ok(
        { token, created: outcome.created },
        outcome.created ? "Account created" : "Login successful",
        outcome.created ? 201 : 200,
      ),
    );
  } catch {
    // Never log the request body: it contains the Apple identity token.
    console.error("[mobile/auth/apple] APPLE_LOGIN_FAILED");

    return respond(fail("INTERNAL_ERROR", 500, "Login failed"));
  }
}
