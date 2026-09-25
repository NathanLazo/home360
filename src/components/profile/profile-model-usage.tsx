"use client";

import { useLocale, useTranslations } from "next-intl";

import type { AiModelUsage } from "./profile.types";
import { getAgentModel, isAgentModelId } from "~/lib/agent/agent-models";
import { formatTokenCount, formatUsdMicros } from "~/lib/agent/agent-pricing";

/** Month-to-date usage per model: turns, tokens and cost, all in mono. */
export function ProfileModelUsage({ usage }: { usage: AiModelUsage[] }) {
  const t = useTranslations("profile.assistant");
  const locale = useLocale();
  const rows = usage.filter((row) => row.turns > 0);

  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-copy font-semibold">{t("usageThisMonth")}</h3>
      {rows.length === 0 ? (
        <p className="text-muted-foreground text-copy-sm bg-canvas-soft rounded-xl px-4 py-3">
          {t("usageEmpty")}
        </p>
      ) : (
        <ul className="divide-hairline divide-y">
          {rows.map((row) => (
            <li
              key={row.model}
              className="flex items-center justify-between gap-4 py-2.5"
            >
              <div className="flex min-w-0 flex-col gap-0.5">
                <p className="text-copy-sm truncate font-medium">
                  {isAgentModelId(row.model)
                    ? getAgentModel(row.model).label
                    : row.model}
                </p>
                <p className="text-muted-foreground text-label font-mono">
                  {t("usageTurns", { turns: row.turns })}
                  <span aria-hidden="true"> · </span>
                  {t("usageTokens", {
                    input: formatTokenCount(row.inputTokens, locale),
                    output: formatTokenCount(row.outputTokens, locale),
                  })}
                </p>
              </div>
              <p className="text-copy-sm shrink-0 font-mono tabular-nums">
                {formatUsdMicros(row.costUsdMicros, locale)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
