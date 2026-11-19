"use client";

import type { PigeonProps } from "pigeon-maps";

import { latitudeNorthOf, type LocatedBranch } from "./branch-coverage.utils";

type BranchCoverageLayerProps = PigeonProps & {
  branches: LocatedBranch[];
};

/**
 * Pigeon child layer: one SVG over the tiles with each branch's real-scale
 * coverage circle, its pin and its name. Re-projects on every pan/zoom frame.
 */
export function BranchCoverageLayer({
  branches,
  latLngToPixel,
  mapState,
}: BranchCoverageLayerProps) {
  if (!latLngToPixel || !mapState) return null;

  return (
    <svg
      width={mapState.width}
      height={mapState.height}
      className="text-foreground pointer-events-none absolute inset-0"
      aria-hidden="true"
    >
      {branches.map((branch) => {
        const [cx, cy] = latLngToPixel([branch.latitude, branch.longitude]);
        const [, northY] = latLngToPixel([
          latitudeNorthOf(branch.latitude, branch.coverageRadiusKm),
          branch.longitude,
        ]);
        const r = Math.max(cy - northY, 0);
        const paused = branch.status === "PAUSED";
        const labelOnLeft = cx > mapState.width - 140;

        return (
          <g key={branch.id}>
            <circle
              cx={cx}
              cy={cy}
              r={r}
              className={
                paused ? "fill-foreground/[0.04]" : "fill-foreground/[0.08]"
              }
              stroke="currentColor"
              strokeOpacity={0.7}
              strokeWidth={1.25}
              strokeDasharray={paused ? "4 4" : undefined}
            />
            <circle
              cx={cx}
              cy={cy}
              r={5}
              className="fill-foreground stroke-background"
              strokeWidth={2}
            />
            <text
              x={labelOnLeft ? cx - 10 : cx + 10}
              y={cy + 4}
              textAnchor={labelOnLeft ? "end" : "start"}
              className="fill-foreground stroke-background font-sans text-[12px] font-medium"
              paintOrder="stroke"
              strokeWidth={4}
              strokeLinejoin="round"
            >
              {branch.name}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
