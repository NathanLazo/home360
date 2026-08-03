import "server-only";

import { createHmac } from "node:crypto";

import { Prisma, type PrismaClient } from "../../../../generated/prisma";
import { env } from "~/env";

export type AuthAction = "login" | "register" | "password-reset";

export type RateLimitRule = {
  action: AuthAction;
  identifier: string;
  max: number;
  windowMinutes: number;
};

export type RateLimitReservation =
  | { allowed: true; attemptIds: string[] }
  | { allowed: false; retryAfterSeconds: number };

const MAX_SERIALIZABLE_ATTEMPTS = 3;
const ATTEMPT_RETENTION_MS = 24 * 60 * 60 * 1_000;

function hmacIdentifier(kind: "email" | "ip", value: string): string {
  const authSecret = env.AUTH_SECRET;

  if (!authSecret) {
    throw new Error("AUTH_SECRET is required for authentication rate limiting");
  }

  const digest = createHmac("sha256", authSecret).update(value).digest("hex");

  return `${kind}:${digest}`;
}

export function emailRateLimitIdentifier(normalizedEmail: string): string {
  return hmacIdentifier("email", normalizedEmail);
}

export function ipRateLimitIdentifier(ip: string): string {
  return hmacIdentifier("ip", ip.trim().toLowerCase());
}

export function clientIpFromHeaders(headers: Headers): string {
  const forwarded =
    headers.get("x-vercel-forwarded-for") ??
    headers.get("x-forwarded-for") ??
    headers.get("x-real-ip");

  const firstAddress = forwarded?.split(",", 1)[0]?.trim();
  return firstAddress && firstAddress.length > 0 ? firstAddress : "unknown";
}

function isSerializableConflict(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2034"
  );
}

function retryAfterSeconds(
  oldestAttempt: Date | undefined,
  windowStart: Date,
  windowMinutes: number,
): number {
  if (!oldestAttempt) {
    return windowMinutes * 60;
  }

  const elapsedMs = oldestAttempt.getTime() - windowStart.getTime();
  return Math.max(1, Math.ceil(elapsedMs / 1_000));
}

export async function reserveRateLimitAttempts(
  db: PrismaClient,
  rules: readonly RateLimitRule[],
): Promise<RateLimitReservation> {
  if (rules.length === 0) {
    return { allowed: true, attemptIds: [] };
  }

  for (
    let transactionAttempt = 0;
    transactionAttempt < MAX_SERIALIZABLE_ATTEMPTS;
    transactionAttempt += 1
  ) {
    try {
      return await db.$transaction(
        async (tx) => {
          const now = new Date();
          const retentionCutoff = new Date(
            now.getTime() - ATTEMPT_RETENTION_MS,
          );
          const consultedPairs = rules.map(({ action, identifier }) => ({
            action,
            identifier,
          }));

          await tx.authAttempt.deleteMany({
            where: {
              createdAt: { lt: retentionCutoff },
              OR: consultedPairs,
            },
          });

          for (const rule of rules) {
            const windowStart = new Date(
              now.getTime() - rule.windowMinutes * 60 * 1_000,
            );
            const where = {
              action: rule.action,
              identifier: rule.identifier,
              createdAt: { gte: windowStart },
            };
            const count = await tx.authAttempt.count({ where });

            if (count >= rule.max) {
              const oldest = await tx.authAttempt.findFirst({
                where,
                orderBy: { createdAt: "asc" },
                select: { createdAt: true },
              });

              return {
                allowed: false,
                retryAfterSeconds: retryAfterSeconds(
                  oldest?.createdAt,
                  windowStart,
                  rule.windowMinutes,
                ),
              };
            }
          }

          const attempts = await Promise.all(
            rules.map((rule) =>
              tx.authAttempt.create({
                data: {
                  action: rule.action,
                  identifier: rule.identifier,
                  createdAt: now,
                },
                select: { id: true },
              }),
            ),
          );

          return {
            allowed: true,
            attemptIds: attempts.map(({ id }) => id),
          };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      if (!isSerializableConflict(error)) {
        throw error;
      }
    }
  }

  return { allowed: false, retryAfterSeconds: 60 };
}

export async function releaseRateLimitAttempts(
  db: PrismaClient,
  attemptIds: readonly string[],
): Promise<void> {
  if (attemptIds.length === 0) {
    return;
  }

  await db.authAttempt.deleteMany({ where: { id: { in: [...attemptIds] } } });
}
