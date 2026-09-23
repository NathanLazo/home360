"use client";

import { SparklesIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { Card, CardContent } from "~/components/ui/card";

export function DisputeAiSummary({ summary }: { summary: string | null }) {
  const t = useTranslations("admin.disputes.aiSummary");

  if (summary === null) {
    return null;
  }

  return (
    <Card className="bg-link-soft/40 border-link-soft">
      <CardContent className="flex gap-3">
        <SparklesIcon
          aria-hidden="true"
          className="text-link-deep mt-0.5 size-4 shrink-0"
        />
        <div className="flex flex-col gap-1">
          <p className="text-link-deep text-label font-mono font-medium tracking-wide uppercase">
            {t("title")}
          </p>
          <p className="text-body text-copy-sm text-pretty">{summary}</p>
        </div>
      </CardContent>
    </Card>
  );
}
