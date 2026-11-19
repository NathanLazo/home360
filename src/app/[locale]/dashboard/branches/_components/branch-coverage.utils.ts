import type { BranchListItem } from "./branch.types";

const KM_PER_DEGREE_LATITUDE = 110.574;
const KM_PER_DEGREE_LONGITUDE_AT_EQUATOR = 111.32;
const TILE_SIZE = 256;
const MIN_ZOOM = 3;
const MAX_ZOOM = 15;

export type LocatedBranch = BranchListItem & {
  latitude: number;
  longitude: number;
};

export type MapPoint = [latitude: number, longitude: number];

export type CoverageView = {
  center: MapPoint;
  zoom: number;
};

export function isLocated(branch: BranchListItem): branch is LocatedBranch {
  return branch.latitude !== null && branch.longitude !== null;
}

/** Normalized Web Mercator x/y in [0, 1] (zoom 0 world = 1 unit). */
function toMercator(latitude: number, longitude: number) {
  const sin = Math.sin((latitude * Math.PI) / 180);
  return {
    x: (longitude + 180) / 360,
    y: 0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI),
  };
}

function fromMercatorY(y: number) {
  return (Math.atan(Math.sinh(Math.PI * (1 - 2 * y))) * 180) / Math.PI;
}

/** The point `km` north of `latitude`: used to turn a radius into pixels. */
export function latitudeNorthOf(latitude: number, km: number) {
  return latitude + km / KM_PER_DEGREE_LATITUDE;
}

/**
 * Center + zoom that fit every coverage circle inside a `width × height`
 * viewport with `padding` px on each side (Web Mercator, like the tiles).
 */
export function fitCoverageView(
  branches: LocatedBranch[],
  width: number,
  height: number,
  padding: number,
): CoverageView | null {
  if (branches.length === 0 || width <= 0 || height <= 0) return null;

  const corners = branches.flatMap((branch) => {
    const latDelta = branch.coverageRadiusKm / KM_PER_DEGREE_LATITUDE;
    const lonDelta =
      branch.coverageRadiusKm /
      (KM_PER_DEGREE_LONGITUDE_AT_EQUATOR *
        Math.cos((branch.latitude * Math.PI) / 180));
    return [
      toMercator(branch.latitude + latDelta, branch.longitude - lonDelta),
      toMercator(branch.latitude - latDelta, branch.longitude + lonDelta),
    ];
  });
  const minX = Math.min(...corners.map((point) => point.x));
  const maxX = Math.max(...corners.map((point) => point.x));
  const minY = Math.min(...corners.map((point) => point.y));
  const maxY = Math.max(...corners.map((point) => point.y));
  const spanX = Math.max(maxX - minX, 1e-9);
  const spanY = Math.max(maxY - minY, 1e-9);
  const usableWidth = Math.max(width - padding * 2, 1);
  const usableHeight = Math.max(height - padding * 2, 1);
  const zoom = Math.min(
    Math.log2(usableWidth / (spanX * TILE_SIZE)),
    Math.log2(usableHeight / (spanY * TILE_SIZE)),
  );

  return {
    center: [fromMercatorY((minY + maxY) / 2), ((minX + maxX) / 2) * 360 - 180],
    // Quarter steps keep tiles crisp while still fitting tightly.
    zoom: Math.min(Math.max(Math.floor(zoom * 4) / 4, MIN_ZOOM), MAX_ZOOM),
  };
}
