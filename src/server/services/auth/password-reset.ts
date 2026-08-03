import "server-only";

import { createHash, randomBytes } from "node:crypto";

import type { PrismaClient } from "../../../../generated/prisma";
import { getPathname } from "~/i18n/navigation";
import type {
  RequestPasswordResetInput,
  ResetPasswordTransportInput,
} from "~/schemas/auth/password-reset.schema";
import type { AuthErrorCode } from "~/schemas/auth/auth-errors";
import { resetPasswordSchema } from "~/schemas/auth/password-reset.schema";
import { fail, ok, type TrpcResponse } from "~/server/api/contract";
import { hashPassword } from "~/server/services/auth/password";
import type { EmailClient } from "~/server/services/email/email-client";
import { sendPasswordReset } from "~/server/services/email/send-password-reset";

const RESET_TOKEN_LIFETIME_MS = 60 * 60 * 1000;
// A common response floor reduces the useful timing signal for local database branches.
// It cannot and does not promise identical network duration for the email provider.
const REQUEST_RESPONSE_FLOOR_MS = 500;
const REQUEST_SUCCESS_MESSAGE =
  "If the account is eligible, a reset email was sent";

const hashToken = (token: string): string =>
  createHash("sha256").update(token).digest("hex");

const waitForResponseFloor = async (startedAtMs: number): Promise<void> => {
  const remainingMs = REQUEST_RESPONSE_FLOOR_MS - (Date.now() - startedAtMs);
  if (remainingMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, remainingMs));
  }
};

export async function requestPasswordReset(
  db: PrismaClient,
  emailClient: EmailClient | null,
  appUrl: string,
  input: RequestPasswordResetInput,
): Promise<TrpcResponse<null>> {
  const startedAtMs = Date.now();

  try {
    const user = await db.user.findUnique({
      where: { email: input.email },
      select: { id: true, email: true, passwordHash: true },
    });

    if (user?.email && user.passwordHash && emailClient) {
      const now = new Date();
      const plainToken = randomBytes(32).toString("base64url");
      const token = await db.$transaction(async (transaction) => {
        await transaction.passwordResetToken.updateMany({
          where: {
            userId: user.id,
            usedAt: null,
            expiresAt: { gt: now },
          },
          data: { usedAt: now },
        });

        return transaction.passwordResetToken.create({
          data: {
            userId: user.id,
            tokenHash: hashToken(plainToken),
            expiresAt: new Date(now.getTime() + RESET_TOKEN_LIFETIME_MS),
          },
          select: { id: true },
        });
      });

      const pathname = getPathname({
        href: "/reset-password",
        locale: input.locale,
      });
      const resetUrl = new URL(pathname, appUrl);
      resetUrl.searchParams.set("token", plainToken);

      try {
        await sendPasswordReset(emailClient, {
          to: user.email,
          resetUrl: resetUrl.toString(),
          locale: input.locale,
        });
      } catch {
        await db.passwordResetToken.updateMany({
          where: { id: token.id, usedAt: null },
          data: { usedAt: new Date() },
        });
        console.error("[password-reset] EMAIL_DELIVERY_FAILED");
      }
    }
  } catch {
    console.error("[password-reset] REQUEST_FAILED");
  }

  await waitForResponseFloor(startedAtMs);
  return ok(null, REQUEST_SUCCESS_MESSAGE, 200);
}

class InvalidResetTokenError extends Error {}

export async function resetPassword(
  db: PrismaClient,
  input: ResetPasswordTransportInput,
): Promise<
  TrpcResponse<{ userId: string }, AuthErrorCode>
> {
  const parsed = resetPasswordSchema.safeParse(input);
  if (!parsed.success) {
    return fail("VALIDATION_ERROR", 400, "Password reset validation failed");
  }

  const now = new Date();
  const tokenHash = hashToken(parsed.data.token);
  const passwordHash = await hashPassword(parsed.data.password);

  try {
    const userId = await db.$transaction(async (transaction) => {
      const token = await transaction.passwordResetToken.findUnique({
        where: { tokenHash },
        select: { id: true, userId: true, usedAt: true, expiresAt: true },
      });

      if (!token) {
        throw new InvalidResetTokenError();
      }

      if (token.usedAt !== null || token.expiresAt <= now) {
        throw new InvalidResetTokenError();
      }

      const claimed = await transaction.passwordResetToken.updateMany({
        where: { id: token.id, usedAt: null, expiresAt: { gt: now } },
        data: { usedAt: now },
      });
      if (claimed.count !== 1) {
        throw new InvalidResetTokenError();
      }

      const user = await transaction.user.update({
        where: { id: token.userId },
        data: { passwordHash, sessionsValidFrom: now },
        select: { id: true },
      });
      return user.id;
    });

    return ok({ userId }, "Password reset", 200);
  } catch (error: unknown) {
    if (error instanceof InvalidResetTokenError) {
      return fail("INVALID_TOKEN", 400, "Invalid password reset token");
    }
    return fail("INTERNAL_ERROR", 500, "Password reset failed");
  }
}
