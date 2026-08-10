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
    <Card className="border-zinc-900/20 bg-zinc-50">
      <CardContent className="flex gap-3">
        <SparklesIcon
          aria-hidden="true"
          className="text-muted-foreground mt-0.5 size-4 shrink-0"
        />
        <div className="flex flex-col gap-1">
          <p className="text-xs font-semibold tracking-wide uppercase">
            {t("title")}
          </p>
          <p className="text-muted-foreground text-sm">{summary}</p>
        </div>
      </CardContent>
    </Card>
  );
}
