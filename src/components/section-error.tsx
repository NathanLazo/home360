"use client";

import { RotateCcwIcon, TriangleAlertIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import type { TranslatableErrorCode } from "~/server/api/contract";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";

export type SectionErrorProps = {
  title: string;
  code: TranslatableErrorCode;
  onRetry: () => void;
};

/**
 * Inline failure state for a single section: the rest of the page stays usable
 * and the retry affordance is local instead of a full-page reset.
 */
export function SectionError({ title, code, onRetry }: SectionErrorProps) {
  const errorsT = useTranslations("errors");
  const commonT = useTranslations("common");

  return (
    <Card role="alert">
      <CardContent className="flex flex-col items-start gap-3">
        <div className="flex items-start gap-3">
          <TriangleAlertIcon
            aria-hidden="true"
            className="text-error mt-0.5 size-5 shrink-0"
          />
          <div className="flex flex-col gap-1">
            <p className="text-copy-sm font-semibold">{title}</p>
            <p className="text-muted-foreground text-copy-sm">
              {errorsT(code)}
            </p>
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={onRetry}
        >
          <RotateCcwIcon aria-hidden="true" />
          {commonT("retry")}
        </Button>
      </CardContent>
    </Card>
  );
}
