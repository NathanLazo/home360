/**
 * Message of the FORBIDDEN thrown to every mutation while an ADMIN
 * impersonates a panel; `toErrorCode` turns it back into its own translatable
 * code. Client-safe on purpose (no Prisma imports).
 */
export const IMPERSONATION_READ_ONLY = "IMPERSONATION_READ_ONLY";
