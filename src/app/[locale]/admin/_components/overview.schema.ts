import { z } from "zod";

/** "YYYY-MM" in the platform's financial time zone; defaults to this month. */
export const overviewMonthSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/u);

export const overviewKpisSchema = z
  .object({ month: overviewMonthSchema.optional() })
  .strict();

export type OverviewKpisInput = z.infer<typeof overviewKpisSchema>;

/** How many months back the W9 month selector offers, current included. */
export const OVERVIEW_MONTH_OPTIONS = 12;
