import { z } from "zod";

/**
 * Primary keys are opaque strings: Prisma defaults to cuid, but seeded rows use
 * readable slugs (`seed-business-volta`), so inputs must not demand a cuid.
 */
export const recordIdSchema = z.string().trim().min(1).max(128);
