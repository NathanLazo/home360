import type { CorporateStatusValue } from "./corporate.schema";

/**
 * Accounts that cannot operate right now: their avatar dozes off. A secondary
 * cue only — the status badge stays the source of truth.
 */
export function isDormantCorporate(status: CorporateStatusValue): boolean {
  return status === "SUSPENDED" || status === "CANCELLED";
}
