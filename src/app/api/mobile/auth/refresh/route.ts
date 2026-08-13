import { fail, ok, type TrpcResponse } from "~/server/api/contract";
import {
  issueMobileToken,
  verifyMobileToken,
} from "~/server/auth/mobile-token";
import { db } from "~/server/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE_HEADERS = { "Cache-Control": "no-store" } as const;

function respond<TResult>(body: TrpcResponse<TResult>): Response {
  return Response.json(body, {
    status: body.status,
    headers: NO_STORE_HEADERS,
  });
}

function bearerToken(request: Request): string | null {
  const authorization = request.headers.get("authorization");

  if (!authorization?.startsWith("Bearer ")) {
    return null;
  }

  const token = authorization.slice("Bearer ".length).trim();

  return token.length > 0 ? token : null;
}

export async function POST(request: Request): Promise<Response> {
  try {
    const currentToken = bearerToken(request);

    if (!currentToken) {
      return respond(fail("INVALID_TOKEN", 401, "Invalid token"));
    }

    const payload = await verifyMobileToken(currentToken);

    if (!payload?.sub || payload.authIssuedAtMs === undefined) {
      return respond(fail("INVALID_TOKEN", 401, "Invalid token"));
    }

    const user = await db.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, role: true, sessionsValidFrom: true },
    });

    if (!user || user.sessionsValidFrom.getTime() > payload.authIssuedAtMs) {
      return respond(fail("INVALID_TOKEN", 401, "Invalid token"));
    }

    const token = await issueMobileToken(user);

    return respond(ok({ token }, "Token refreshed"));
  } catch {
    // Never log the Authorization header or tokens.
    console.error("[mobile/auth/refresh] REFRESH_FAILED");

    return respond(fail("INTERNAL_ERROR", 500, "Refresh failed"));
  }
}
