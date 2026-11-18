import { z } from "zod";

import { recordIdSchema } from "~/schemas/record-id.schema";

export const REPORT_STATUS_FILTERS = ["open", "resolved"] as const;

export type ReportStatusFilter = (typeof REPORT_STATUS_FILTERS)[number];

export const listReportsSchema = z.object({
  status: z.enum(REPORT_STATUS_FILTERS).default("open"),
  cursor: recordIdSchema.optional(),
});

export const REPORT_ACTIONS = ["HIDE_CONTENT", "DISMISS"] as const;

export type ReportAction = (typeof REPORT_ACTIONS)[number];

export const resolveReportSchema = z.object({
  reportId: recordIdSchema,
  action: z.enum(REPORT_ACTIONS),
});
