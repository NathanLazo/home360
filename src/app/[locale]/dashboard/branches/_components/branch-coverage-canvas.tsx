"use client";

import { useTheme } from "next-themes";
import { useTranslations } from "next-intl";
import { Map } from "pigeon-maps";
import { useMemo } from "react";

import { BranchCoverageLayer } from "./branch-coverage-layer";
import { fitCoverageView, type LocatedBranch } from "./branch-coverage.utils";
import { cartoTiles } from "./branch-map-tiles";
import { useElementSize } from "./use-element-size";
import { usePrefersReducedMotion } from "~/hooks/use-prefers-reduced-motion";

const PADDING = 32;

/**
 * Interactive tile map (pigeon-maps, client only). Fits every coverage
 * circle on mount and on resize; the user can then pan and zoom freely.
 */
export function BranchCoverageCanvas({
  branches,
}: {
  branches: LocatedBranch[];
}) {
  const t = useTranslations("dashboard.branches.map");
  const { resolvedTheme } = useTheme();
  const reducedMotion = usePrefersReducedMotion();
  const { ref, width, height } = useElementSize<HTMLDivElement>();
  const view = useMemo(
    () => fitCoverageView(branches, width, height, PADDING),
    [branches, width, height],
  );
  const provider = useMemo(
    () => cartoTiles(resolvedTheme === "dark" ? "dark" : "light"),
    [resolvedTheme],
  );

  return (
    <div ref={ref} className="h-64 w-full sm:h-80">
      {view ? (
        <Map
          // Re-fit when the viewport or the branch set changes.
          key={`${width}x${height}:${view.center.join(",")}:${view.zoom}`}
          width={width}
          height={height}
          defaultCenter={view.center}
          defaultZoom={view.zoom}
          provider={provider}
          dprs={[1, 2]}
          animate={!reducedMotion}
          metaWheelZoom
          metaWheelZoomWarning={t("wheelHint")}
          twoFingerDrag
          twoFingerDragWarning={t("dragHint")}
          attributionPrefix={false}
          attribution={<span className="text-[11px]">{t("attribution")}</span>}
        >
          <BranchCoverageLayer branches={branches} />
        </Map>
      ) : null}
    </div>
  );
}
