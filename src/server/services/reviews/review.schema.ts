import { z } from "zod";

export const REVIEW_MIN_RATING = 1;
export const REVIEW_MAX_RATING = 5;
export const REVIEW_COMMENT_MAX_LENGTH = 1000;

/** C6 confirmation rating (P-WEB-02): integer 1–5 plus an optional comment. */
export const createReviewSchema = z.object({
  orderId: z.string().cuid(),
  rating: z.number().int().min(REVIEW_MIN_RATING).max(REVIEW_MAX_RATING),
  comment: z
    .string()
    .trim()
    .max(REVIEW_COMMENT_MAX_LENGTH)
    .optional()
    .transform((value) => (value === "" ? undefined : value)),
});

export type CreateReviewInput = z.infer<typeof createReviewSchema>;
