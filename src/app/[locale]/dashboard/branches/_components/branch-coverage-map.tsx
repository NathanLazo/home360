"use client";

import { MapPinOffIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import {
  isLocated,
  projectBranches,
  type ProjectedBranch,
} from "./branch-coverage.utils";
import type { BranchListItem } from "./branch.types";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";

const WIDTH = 640;
const HEIGHT = 260;
const PADDING = 28;

function MapGrid() {
  return (
    <g className="text-border" aria-hidden="true">
      {Array.from({ length: 19 }, (_, index) => (index + 1) * 32).map((x) => (
        <line
          key={`x-${x}`}
          x1={x}
          y1="0"
          x2={x}
          y2={HEIGHT}
          stroke="currentColor"
          strokeWidth="0.5"
        />
      ))}
      {Array.from({ length: 8 }, (_, index) => (index + 1) * 32).map((y) => (
        <line
          key={`y-${y}`}
          x1="0"
          y1={y}
          x2={WIDTH}
          y2={y}
          stroke="currentColor"
          strokeWidth="0.5"
        />
      ))}
    </g>
  );
}

function BranchMark({ branch }: { branch: ProjectedBranch }) {
  const paused = branch.status === "PAUSED";
  // Keep the label inside the viewBox: flip it to the left near the edge.
  const labelOnLeft = branch.cx > WIDTH - 140;

  return (
    <g>
      <circle
        cx={branch.cx}
        cy={branch.cy}
        r={branch.r}
        className={paused ? "fill-foreground/[0.03]" : "fill-foreground/[0.06]"}
        stroke="currentColor"
        strokeWidth="1.25"
        strokeDasharray={paused ? "4 4" : undefined}
      />
      <circle
        cx={branch.cx}
        cy={branch.cy}
        r="4.5"
        className="fill-foreground"
        stroke="none"
      />
      <text
        x={labelOnLeft ? branch.cx - 9 : branch.cx + 9}
        y={branch.cy + 4}
        textAnchor={labelOnLeft ? "end" : "start"}
        className="fill-foreground font-sans text-[12px] font-medium"
        paintOrder="stroke"
        stroke="var(--canvas-soft, transparent)"
        strokeWidth="4"
        strokeLinejoin="round"
      >
        {branch.name}
      </text>
    </g>
  );
}

/**
 * Coverage overview (W8): every located branch at its real position with its
 * coverage radius on the same km scale, so overlaps and gaps are visible.
 */
export function BranchCoverageMap({
  branches,
}: {
  branches: BranchListItem[];
}) {
  const t = useTranslations("dashboard.branches.map");
  const located = branches.filter(isLocated);
  const projected = projectBranches(located, WIDTH, HEIGHT, PADDING);
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
        <div className="bg-canvas-soft relative border-t">
          {projected.length > 0 ? (
            <svg
              viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
              className="text-foreground/70 block h-56 w-full sm:h-64"
              preserveAspectRatio="xMidYMid meet"
              role="img"
              aria-label={t("ariaLabel", {
                branches: projected
                  .map((branch) =>
                    t("ariaBranch", {
                      name: branch.name,
                      radius: branch.radiusKm,
                    }),
                  )
                  .join(", "),
              })}
            >
              <MapGrid />
              {projected.map((branch) => (
                <BranchMark key={branch.id} branch={branch} />
              ))}
            </svg>
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
          {projected.length > 0 && missing > 0 ? (
            <p className="text-warning-deep bg-canvas shadow-subtle text-copy-sm absolute bottom-3 left-3 rounded-sm px-2 py-1">
              {t("missing", { count: missing })}
            </p>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
