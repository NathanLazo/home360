import "server-only";

import { createHash, createHmac } from "node:crypto";

import { env } from "~/env";

/** RFC 4648 base32 alphabet: no 0/1/8/9, easy to read aloud or type. */
const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export const PICKUP_CODE_LENGTH = 10;

function toBase32(bytes: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let output = "";

  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;

    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31] ?? "";
      bits -= 5;
    }
  }

  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31] ?? "";
  }

  return output;
}

/** Whether pickup codes can be issued in this deployment. */
export function isPickupCodeConfigured(): boolean {
  return (env.PICKUP_CODE_SECRET ?? "").length > 0;
}

/**
 * D10-2 pickup code: base32(HMAC-SHA256(PICKUP_CODE_SECRET, order.id))
 * truncated to 10 characters (50 bits). Deterministic, so the customer's
 * tracking view can always re-render the QR, and never stored: only its
 * SHA-256 lives on `Order.pickupCodeHash`. `null` without the secret.
 */
export function derivePickupCode(orderId: string): string | null {
  const secret = env.PICKUP_CODE_SECRET;

  if (!secret) {
    return null;
  }

  const digest = createHmac("sha256", secret).update(orderId).digest();

  return toBase32(digest).slice(0, PICKUP_CODE_LENGTH);
}

/** Canonical form of a scanned or typed code (case, spaces and dashes). */
export function normalizePickupCode(code: string): string {
  return code.replace(/[\s-]/g, "").toUpperCase();
}

/** SHA-256 hex of the canonical code: the lookup key of `redeemPickup`. */
export function hashPickupCode(code: string): string {
  return createHash("sha256").update(normalizePickupCode(code)).digest("hex");
}
