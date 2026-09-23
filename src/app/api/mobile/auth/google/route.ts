import { z } from "zod";

import { fail, ok, type TrpcResponse } from "~/server/api/contract";
import { issueMobileToken } from "~/server/auth/mobile-token";
import { db } from "~/server/db";
import { verifyGoogleIdToken } from "~/server/services/auth/google-id-token";
import { signInWithGoogle } from "~/server/services/auth/google-mobile-sign-in";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE_HEADERS = { "Cache-Control": "no-store" } as const;

const bodySchema = z.object({
  idToken: z.string().min(1),
  // Locale of a brand-new CUSTOMER account; ignored for existing users.
  locale: z.enum(["es", "en"]).default("es"),
});

function respond<TResult>(body: TrpcResponse<TResult>): Response {
  return Response.json(body, {
    status: body.status,
    headers: NO_STORE_HEADERS,
  });
}

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
      return respond(fail("UNAUTHORIZED", 401, "Invalid Google token"));
    }

    const googleToken = await verifyGoogleIdToken(parsed.data.idToken);

    if (!googleToken) {
      return respond(fail("UNAUTHORIZED", 401, "Invalid Google token"));
    }

    // Unknown verified emails sign up as CUSTOMER (workstream D) instead of
    // the former 404; suspended accounts answer the same generic 401.
    const outcome = await signInWithGoogle(db, {
      token: googleToken,
      locale: parsed.data.locale,
    });

    if (outcome.kind === "BLOCKED") {
      return respond(fail("UNAUTHORIZED", 401, "Invalid Google token"));
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
    // Never log the request body: it contains the Google id_token.
    console.error("[mobile/auth/google] GOOGLE_LOGIN_FAILED");

    return respond(fail("INTERNAL_ERROR", 500, "Login failed"));
  }
}
