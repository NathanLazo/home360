"use client";

import { EyeOffIcon, LoaderCircleIcon, XIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { ADMIN_TONE_CLASS } from "../../_components/admin-surface";
import type { ReportAction } from "./reports.schema";
import type { ReportItem } from "./reports.types";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { useAppFormatter } from "~/i18n/use-app-formatter";
import { cn } from "~/lib/utils";

const statusTone = {
  OPEN: ADMIN_TONE_CLASS.warning,
  CONTENT_HIDDEN: ADMIN_TONE_CLASS.neutral,
  DISMISSED: ADMIN_TONE_CLASS.neutral,
} as const;

/** One report: reason, reported content, who reported whom, and actions. */
export function ReportCard({
  report,
  now,
  pending,
  onResolve,
}: {
  report: ReportItem;
  now: Date;
  pending: boolean;
  onResolve: (action: ReportAction) => void;
}) {
  const t = useTranslations("admin.reports");
  const formatter = useAppFormatter();
  const open = report.status === "OPEN";
  const message = report.message;
  const quoted =
    message === null
      ? t("wholeConversation")
      : message.type === "TEXT"
        ? (message.body ?? "")
        : t(`messageType.${message.type}`);
  const reportedName =
    report.reportedUser?.name ?? report.business?.name ?? t("unknownUser");

  return (
    <article
      aria-labelledby={`report-${report.id}`}
      className="bg-card shadow-subtle flex flex-col gap-3 rounded-xl p-4"
    >
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h2 id={`report-${report.id}`} className="text-copy font-medium">
            {t(`reasons.${report.reason}`)}
          </h2>
          <Badge variant="outline" className={cn(statusTone[report.status])}>
            {t(`statuses.${report.status}`)}
          </Badge>
        </div>
        <time
          dateTime={report.createdAt.toISOString()}
          className="text-copy-sm text-muted-foreground font-mono"
        >
          {formatter.relativeTime(report.createdAt, now)}
        </time>
      </header>

      <blockquote className="bg-canvas-soft text-copy text-foreground rounded-md border px-3 py-2 break-words whitespace-pre-wrap">
        {quoted}
      </blockquote>

      {report.details ? (
        <p className="text-copy-sm text-muted-foreground">
          {t("details", { details: report.details })}
        </p>
      ) : null}

      <dl className="text-copy-sm grid gap-1 sm:grid-cols-3">
        <div>
          <dt className="text-muted-foreground">{t("reporter")}</dt>
          <dd className="truncate">
            {report.reporter.name ?? report.reporter.email}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">{t("reported")}</dt>
          <dd className="truncate">{reportedName}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">{t("business")}</dt>
          <dd className="truncate">{report.business?.name ?? "—"}</dd>
        </div>
      </dl>

      {open ? (
        <div className="flex flex-wrap gap-2">
          {message !== null ? (
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => onResolve("HIDE_CONTENT")}
            >
              {pending ? (
                <LoaderCircleIcon
                  aria-hidden="true"
                  className="animate-spin motion-reduce:animate-none"
                />
              ) : (
                <EyeOffIcon aria-hidden="true" />
              )}
              {t("actions.hide")}
            </Button>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            disabled={pending}
            onClick={() => onResolve("DISMISS")}
          >
            <XIcon aria-hidden="true" />
            {t("actions.dismiss")}
          </Button>
        </div>
      ) : null}
    </article>
  );
}
