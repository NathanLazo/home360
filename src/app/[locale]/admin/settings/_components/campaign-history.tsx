"use client";

import { LoaderCircleIcon, MegaphoneIcon } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";

import { EmptyState } from "~/components/empty-state";
import { SectionError } from "~/components/section-error";
import { Button } from "~/components/ui/button";
import { Skeleton } from "~/components/ui/skeleton";
import { toErrorCode } from "~/lib/trpc-errors";
import { api } from "~/trpc/react";

/** Sent campaigns, newest first, paged with "Cargar más". */
export function CampaignHistory() {
  const t = useTranslations("admin.settings.campaigns");
  const audienceT = useTranslations("admin.settings.campaigns.audience");
  const formatter = useFormatter();
  const query = api.admin.settings.listCampaigns.useInfiniteQuery(
    {},
    {
      getNextPageParam: (lastPage) => lastPage.result?.nextCursor ?? undefined,
    },
  );

  const pages = query.data?.pages ?? [];
  const errorCode =
    pages.find((page) => page.error !== null)?.error ??
    (query.error ? toErrorCode(query.error) : null);
  const campaigns = pages.flatMap((page) => page.result?.items ?? []);

  if (query.isPending) {
    return (
      <div className="flex flex-col gap-2" role="status" aria-busy="true">
        <span className="sr-only">{t("historyLoading")}</span>
        {Array.from({ length: 3 }, (_, index) => (
          <Skeleton key={index} className="h-16 w-full rounded-md" />
        ))}
      </div>
    );
  }

  if (errorCode !== null) {
    return (
      <SectionError
        title={t("historyErrorTitle")}
        code={errorCode}
        onRetry={() => void query.refetch()}
      />
    );
  }

  if (campaigns.length === 0) {
    return (
      <EmptyState
        icon={MegaphoneIcon}
        title={t("historyEmptyTitle")}
        description={t("historyEmptyDescription")}
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col divide-y rounded-xl border">
        {campaigns.map((campaign) => (
          <li key={campaign.id} className="flex flex-col gap-1 px-4 py-3">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <span className="font-medium">{campaign.title}</span>
              <time
                dateTime={campaign.sentAt.toISOString()}
                className="text-muted-foreground text-xs"
              >
                {formatter.dateTime(campaign.sentAt, {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              </time>
            </div>
            <p className="text-muted-foreground text-copy-sm text-pretty">
              {campaign.body}
            </p>
            <p className="text-muted-foreground text-xs">
              {t("historyMeta", {
                audience: audienceT(campaign.audience),
                count: campaign.recipientCount,
                sender: campaign.sentByName ?? t("unknownSender"),
              })}
            </p>
          </li>
        ))}
      </ul>
      {query.hasNextPage ? (
        <Button
          type="button"
          variant="outline"
          className="self-center"
          disabled={query.isFetchingNextPage}
          onClick={() => void query.fetchNextPage()}
        >
          {query.isFetchingNextPage ? (
            <LoaderCircleIcon
              aria-hidden="true"
              className="animate-spin motion-reduce:animate-none"
            />
          ) : null}
          {t("loadMore")}
        </Button>
      ) : null}
    </div>
  );
}
