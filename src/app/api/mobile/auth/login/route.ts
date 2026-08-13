import { fail, ok, type TrpcResponse } from "~/server/api/contract";
import { issueMobileToken } from "~/server/auth/mobile-token";
import { db } from "~/server/db";
import { verifyCredentials } from "~/server/services/auth/verify-credentials";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE_HEADERS = { "Cache-Control": "no-store" } as const;

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

    const user = await verifyCredentials(db, body, request.headers);

    if (!user) {
      // Invalid input, rate limit and wrong credentials are indistinguishable
      // on purpose, mirroring the web login flow.
      return respond(fail("UNAUTHORIZED", 401, "Invalid credentials"));
    }

    const token = await issueMobileToken(user);

    return respond(ok({ token }, "Login successful"));
  } catch {
    // Never log request bodies or tokens here: they contain credentials.
    console.error("[mobile/auth/login] LOGIN_FAILED");

    return respond(fail("INTERNAL_ERROR", 500, "Login failed"));
  }
}
