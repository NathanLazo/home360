import {
  workerCreateSchema,
  workerUpdateSchema,
} from "~/schemas/team/worker.schema";
import type { z } from "zod";

/**
 * Client mirrors of the F6-08 input schemas. The shared schemas stay the single
 * source of truth: `locale` is dropped here because the form never collects it
 * (the view derives it from next-intl right before mutating).
 */
export const workerCreateFormSchema = workerCreateSchema.omit({ locale: true });

export const workerUpdateFormSchema = workerUpdateSchema;

export type WorkerCreateFormInput = z.infer<typeof workerCreateFormSchema>;
export type WorkerUpdateFormInput = z.infer<typeof workerUpdateFormSchema>;
