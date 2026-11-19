"use client";

import { MapPinOffIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import dynamic from "next/dynamic";

import { isLocated } from "./branch-coverage.utils";
import type { BranchListItem } from "./branch.types";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Skeleton } from "~/components/ui/skeleton";

// pigeon-maps touches `window` on mount: keep it out of the server render.
const BranchCoverageCanvas = dynamic(
  () =>
    import("./branch-coverage-canvas").then(
      (module) => module.BranchCoverageCanvas,
    ),
  {
    ssr: false,
    loading: () => <Skeleton className="h-64 w-full rounded-none sm:h-80" />,
  },
);

/**
 * Coverage overview (W8): every located branch on a real tile map with its
 * coverage radius at true km scale, so overlaps and gaps are visible.
 */
export function BranchCoverageMap({
  branches,
}: {
  branches: BranchListItem[];
}) {
  const t = useTranslations("dashboard.branches.map");
  const located = branches.filter(isLocated);
  const missing = branches.length - located.length;

  return (
    <Card className="gap-0 overflow-hidden py-0">
      <CardHeader className="flex flex-row flex-wrap items-baseline justify-between gap-2 px-5 py-4">
        <CardTitle>
          <h2>{t("title")}</h2>
        </CardTitle>
        <p className="text-muted-foreground text-copy-sm">
          {t("summary", { located: located.length, total: branches.length })}
        </p>
      </CardHeader>
      <CardContent className="px-0">
        <div className="bg-canvas-soft relative isolate border-t">
          {located.length > 0 ? (
            <figure
              aria-label={t("ariaLabel", {
                branches: located
                  .map((branch) =>
                    t("ariaBranch", {
                      name: branch.name,
                      radius: branch.coverageRadiusKm,
                    }),
                  )
                  .join(", "),
              })}
            >
              <BranchCoverageCanvas branches={located} />
            </figure>
          ) : (
            <div className="flex h-40 flex-col items-center justify-center gap-2 px-6 text-center">
              <MapPinOffIcon
                aria-hidden="true"
                className="text-muted-foreground size-5"
              />
              <p className="font-medium">{t("emptyTitle")}</p>
              <p className="text-muted-foreground text-copy-sm max-w-md">
                {t("emptyDescription")}
              </p>
            </div>
          )}
          {located.length > 0 && missing > 0 ? (
            <p className="text-warning-deep bg-canvas shadow-subtle text-copy-sm pointer-events-none absolute top-3 left-3 z-10 rounded-sm px-2 py-1">
              {t("missing", { count: missing })}
            </p>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
