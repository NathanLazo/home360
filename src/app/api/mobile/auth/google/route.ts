import { z } from "zod";

import { fail, ok, type TrpcResponse } from "~/server/api/contract";
import { issueMobileToken } from "~/server/auth/mobile-token";
import { db } from "~/server/db";
import { verifyGoogleIdToken } from "~/server/services/auth/google-id-token";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE_HEADERS = { "Cache-Control": "no-store" } as const;

const bodySchema = z.object({ idToken: z.string().min(1) });

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

    const user = await db.user.findUnique({
      where: { email: googleToken.email },
      select: { id: true, role: true },
    });

    if (!user) {
      // Customer registration arrives in M1-W1; until then unknown Google
      // accounts cannot sign in from mobile.
      return respond(fail("NOT_FOUND", 404, "User not found"));
    }

    const token = await issueMobileToken(user);

    return respond(ok({ token }, "Login successful"));
  } catch {
    // Never log the request body: it contains the Google id_token.
    console.error("[mobile/auth/google] GOOGLE_LOGIN_FAILED");

    return respond(fail("INTERNAL_ERROR", 500, "Login failed"));
  }
}
