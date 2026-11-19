import type { RadarRequestItem } from "./request.types";

export type RequestEvidenceItem = RadarRequestItem["evidence"][number];

/** Request media pathnames embed their kind as the second segment (M0-W3). */
export function isVideoEvidence(item: RequestEvidenceItem): boolean {
  return item.pathname.split("/")[1] === "requestVideo";
}
