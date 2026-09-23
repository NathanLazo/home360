"use client";

import { LoaderCircleIcon, RefreshCwIcon, SparklesIcon } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";

import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";

/**
 * AI case summary. Three states: not generated yet (explicit CTA), being
 * generated (spinner on the button, previous text kept) and generated (text
 * plus a quiet "Regenerar"). The summary is advisory; it never decides.
 */
export function DisputeAiSummary({
  summary,
  generatedAt,
  generating,
  onGenerate,
}: {
  summary: string | null;
  generatedAt: Date | null;
  generating: boolean;
  onGenerate: () => void;
}) {
  const t = useTranslations("admin.disputes.aiSummary");
  const formatter = useFormatter();
  const hasSummary = summary !== null && summary.length > 0;

  return (
    <Card className="bg-link-soft/40 border-link-soft">
      <CardContent className="flex gap-3">
        <SparklesIcon
          aria-hidden="true"
          className="text-link-deep mt-0.5 size-4 shrink-0"
        />
        <div className="flex min-w-0 flex-1 flex-col gap-2" aria-live="polite">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-link-deep text-label font-mono font-medium tracking-wide uppercase">
              {t("title")}
            </p>
            {hasSummary ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={generating}
                aria-busy={generating || undefined}
                onClick={onGenerate}
              >
                {generating ? (
                  <LoaderCircleIcon
                    aria-hidden="true"
                    className="animate-spin motion-reduce:animate-none"
                  />
                ) : (
                  <RefreshCwIcon aria-hidden="true" />
                )}
                {generating ? t("generating") : t("regenerate")}
              </Button>
            ) : null}
          </div>

          {hasSummary ? (
            <>
              <p className="text-body text-copy-sm text-pretty">{summary}</p>
              {generatedAt ? (
                <p className="text-muted-foreground text-xs">
                  {t("generatedAt", {
                    date: formatter.dateTime(generatedAt, {
                      dateStyle: "medium",
                      timeStyle: "short",
                    }),
                  })}
                </p>
              ) : null}
            </>
          ) : (
            <div className="flex flex-col items-start gap-3">
              <p className="text-muted-foreground text-copy-sm text-pretty">
                {t("notGenerated")}
              </p>
              <Button
                type="button"
                variant="outline"
                disabled={generating}
                aria-busy={generating || undefined}
                onClick={onGenerate}
              >
                {generating ? (
                  <LoaderCircleIcon
                    aria-hidden="true"
                    className="animate-spin motion-reduce:animate-none"
                  />
                ) : (
                  <SparklesIcon aria-hidden="true" />
                )}
                {generating ? t("generating") : t("generate")}
              </Button>
            </div>
          )}

          <p className="text-muted-foreground text-xs">{t("disclaimer")}</p>
        </div>
      </CardContent>
    </Card>
  );
}
