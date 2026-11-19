import { z } from "zod";

/** Mirrors `orderCancelSchema.reason` on the server. */
export const orderCancelReasonSchema = z.string().trim().min(3).max(500);
