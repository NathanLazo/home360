import "server-only";

import { Prisma, type PrismaClient } from "@generated/prisma";

const MAX_SERIALIZABLE_ATTEMPTS = 3;
const BASE_BACKOFF_MS = 25;

/** Postgres serialization failure / deadlock surfaced by Prisma. */
export function isSerializationConflict(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2034"
  );
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Runs `fn` in a Serializable transaction, retrying serialization conflicts
 * (P2034) up to three times with a short backoff. `onExhausted` builds the
 * caller's stable CONFLICT result once every attempt lost the race. External
 * I/O never belongs inside `fn` (roger-arq §8).
 */
export async function runSerializable<T>(
  db: PrismaClient,
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
  onExhausted: () => T,
): Promise<T> {
  for (let attempt = 0; attempt < MAX_SERIALIZABLE_ATTEMPTS; attempt += 1) {
    try {
      return await db.$transaction(fn, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      });
    } catch (error) {
      if (!isSerializationConflict(error)) {
        throw error;
      }

      if (attempt + 1 < MAX_SERIALIZABLE_ATTEMPTS) {
        await wait(BASE_BACKOFF_MS * (attempt + 1));
      }
    }
  }

  return onExhausted();
}
