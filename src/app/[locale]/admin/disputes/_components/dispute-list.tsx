"use client";

import { LoaderCircleIcon, ScaleIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, type ReactNode } from "react";

import { DisputeListItem } from "./dispute-list-item";
import type { DisputeListItem as DisputeListItemType } from "./disputes.types";
import { EmptyState } from "~/components/empty-state";
import { Button } from "~/components/ui/button";

export function DisputeList({
  disputes,
  selectedId,
  hasMore,
  loadingMore,
  onLoadMore,
  onSelect,
  emptyAction,
}: {
  disputes: DisputeListItemType[];
  selectedId: string | null;
  hasMore: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
  onSelect: (disputeId: string) => void;
  emptyAction?: ReactNode;
}) {
  const t = useTranslations("admin.disputes");
  // Frozen on mount so every relative date shares one reference instant.
  const [now] = useState(() => new Date());

  if (disputes.length === 0) {
    return (
      <EmptyState
        icon={ScaleIcon}
        title={t("empty.title")}
        description={t("empty.description")}
        action={emptyAction}
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col gap-2">
        {disputes.map((dispute) => (
          <li key={dispute.id}>
            <DisputeListItem
              dispute={dispute}
              active={dispute.id === selectedId}
              now={now}
              onSelect={() => onSelect(dispute.id)}
            />
          </li>
        ))}
      </ul>
      {hasMore ? (
        <Button
          type="button"
          variant="outline"
          className="min-h-11 transition-transform duration-150 ease-out active:scale-[0.96] sm:min-h-10"
          disabled={loadingMore}
          onClick={onLoadMore}
        >
          {loadingMore ? (
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
