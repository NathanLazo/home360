"use client";

import { useFormatter, useLocale, useTranslations } from "next-intl";

import type { AiUsageRow as AiUsageRowData } from "./profile.types";
import { getAgentModel, isAgentModelId } from "~/lib/agent/agent-models";
import { formatTokenCount, formatUsdMicros } from "~/lib/agent/agent-pricing";

/**
 * One ledger entry. Two-line row on phones (date + model / tokens + cost),
 * one grid line from `sm`. Origin is text, never color alone.
 */
export function AiUsageRow({ row }: { row: AiUsageRowData }) {
  const t = useTranslations("profile.billing");
  const format = useFormatter();
  const locale = useLocale();
  const model = isAgentModelId(row.model)
    ? getAgentModel(row.model).label
    : row.model;

  return (
    <li className="hover:bg-canvas-soft-2 grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 px-1 py-3 transition-colors duration-150 ease-out motion-reduce:transition-none sm:grid-cols-[8.5rem_minmax(0,1fr)_auto_5.5rem] sm:items-center sm:gap-y-0">
      <p className="text-muted-foreground text-label font-mono sm:order-1">
        {format.dateTime(row.createdAt, {
          dateStyle: "medium",
          timeStyle: "short",
        })}
      </p>
      <p className="text-copy-sm col-start-1 row-start-2 flex flex-wrap items-center gap-x-2 sm:order-2 sm:col-auto sm:row-auto">
        <span className="font-medium">{model}</span>
        <span className="border-hairline bg-canvas-soft text-muted-foreground rounded-pill border px-2 py-0.5 text-xs">
          {t(`origin.${row.settlement}`)}
        </span>
      </p>
      <p className="text-muted-foreground text-label col-start-1 row-start-3 font-mono sm:order-3 sm:col-auto sm:row-auto sm:text-end">
        {t("ledger.tokens", {
          input: formatTokenCount(row.inputTokens, locale),
          output: formatTokenCount(row.outputTokens, locale),
        })}
      </p>
      <p className="text-copy-sm col-start-2 row-span-3 row-start-1 self-center text-end font-mono tabular-nums sm:order-4 sm:col-auto sm:row-auto">
        {formatUsdMicros(row.costUsdMicros, locale)}
      </p>
    </li>
  );
}
