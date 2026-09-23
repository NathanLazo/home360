import type { UsersFiltersInput } from "./users.schema";

/**
 * Only the filters that apply to the active tab reach the server, so the
 * query key (and the SSR prefetch that mirrors it) stays canonical.
 */
export function toUsersFilters(input: {
  tab: UsersFiltersInput["tab"];
  search: string;
  status: UsersFiltersInput["status"];
  accessStatus: UsersFiltersInput["accessStatus"];
  availability: UsersFiltersInput["availability"];
}): UsersFiltersInput {
  const search = input.search.trim();

  return {
    tab: input.tab,
    ...(search.length > 0 ? { search } : {}),
    ...(input.tab === "businesses" && input.status
      ? { status: input.status }
      : {}),
    ...(input.tab === "customers" && input.accessStatus
      ? { accessStatus: input.accessStatus }
      : {}),
    ...(input.tab === "workers" && input.availability
      ? { availability: input.availability }
      : {}),
  };
}
