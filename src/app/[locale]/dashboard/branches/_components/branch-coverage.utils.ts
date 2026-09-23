import type { BranchListItem } from "./branch.types";

const KM_PER_DEGREE_LATITUDE = 110.574;
const KM_PER_DEGREE_LONGITUDE_AT_EQUATOR = 111.32;

export type LocatedBranch = BranchListItem & {
  latitude: number;
  longitude: number;
};

export type ProjectedBranch = {
  id: string;
  name: string;
  status: BranchListItem["status"];
  radiusKm: number;
  cx: number;
  cy: number;
  r: number;
};

export function isLocated(branch: BranchListItem): branch is LocatedBranch {
  return branch.latitude !== null && branch.longitude !== null;
}

/**
 * Local equirectangular projection (accurate at city scale) fitted into a
 * `width × height` viewBox. Positions and coverage circles share one km→unit
 * scale, so radii are comparable across branches and with the distances
 * between them.
 */
export function projectBranches(
  branches: LocatedBranch[],
  width: number,
  height: number,
  padding: number,
): ProjectedBranch[] {
  if (branches.length === 0) return [];

  const originLatitude =
    branches.reduce((total, branch) => total + branch.latitude, 0) /
    branches.length;
  const originLongitude =
    branches.reduce((total, branch) => total + branch.longitude, 0) /
    branches.length;
  const kmPerDegreeLongitude =
    KM_PER_DEGREE_LONGITUDE_AT_EQUATOR *
    Math.cos((originLatitude * Math.PI) / 180);
  const points = branches.map((branch) => ({
    branch,
    x: (branch.longitude - originLongitude) * kmPerDegreeLongitude,
    // SVG y grows downwards; north stays up.
    y: -(branch.latitude - originLatitude) * KM_PER_DEGREE_LATITUDE,
    radius: branch.coverageRadiusKm,
  }));
  const minX = Math.min(...points.map((point) => point.x - point.radius));
  const maxX = Math.max(...points.map((point) => point.x + point.radius));
  const minY = Math.min(...points.map((point) => point.y - point.radius));
  const maxY = Math.max(...points.map((point) => point.y + point.radius));
  const spanX = Math.max(maxX - minX, 1);
  const spanY = Math.max(maxY - minY, 1);
  const scale = Math.min(
    (width - padding * 2) / spanX,
    (height - padding * 2) / spanY,
  );
  const offsetX = (width - spanX * scale) / 2;
  const offsetY = (height - spanY * scale) / 2;

  return points.map(({ branch, x, y, radius }) => ({
    id: branch.id,
    name: branch.name,
    status: branch.status,
    radiusKm: radius,
    cx: offsetX + (x - minX) * scale,
    cy: offsetY + (y - minY) * scale,
    r: radius * scale,
  }));
}
