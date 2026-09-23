"use client";

import { usePathname, useRouter } from "next/navigation";
import { useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";

import {
  businessDeepLinkActionSchema,
  businessDerivedStatusSchema,
  businessSheetSectionSchema,
  userAccessStatusSchema,
  usersTabSchema,
  workerAvailabilitySchema,
  type BusinessDerivedStatus,
  type BusinessSheetSection,
  type UserAccessStatus,
  type UsersTab,
  type WorkerAvailabilityValue,
} from "./users.schema";

/** Params that only make sense inside one tab; cleared on every tab change. */
const TAB_SCOPED_PARAMS = [
  "status",
  "access",
  "availability",
  "business",
  "section",
  "action",
  "customer",
] as const;

export type UsersUrlState = {
  tab: UsersTab;
  search: string;
  status: BusinessDerivedStatus | undefined;
  accessStatus: UserAccessStatus | undefined;
  availability: WorkerAvailabilityValue | undefined;
  businessId: string | null;
  businessSection: BusinessSheetSection | null;
  /** Deep-link request to open the approval dialog on arrival (W9). */
  approveRequested: boolean;
  customerId: string | null;
  setTab: (tab: UsersTab) => void;
  setSearch: (search: string) => void;
  setStatus: (status: BusinessDerivedStatus | undefined) => void;
  setAccessStatus: (status: UserAccessStatus | undefined) => void;
  setAvailability: (availability: WorkerAvailabilityValue | undefined) => void;
  clearFilters: () => void;
  openBusiness: (businessId: string, section?: BusinessSheetSection) => void;
  closeBusiness: () => void;
  clearApproveRequest: () => void;
  openCustomer: (customerId: string) => void;
  closeCustomer: () => void;
};

function parseOptional<T>(
  schema: { safeParse: (value: unknown) => { success: boolean; data?: T } },
  value: string | null,
): T | undefined {
  const parsed = schema.safeParse(value);
  return parsed.success ? parsed.data : undefined;
}

/**
 * Tab, search, filters and the detail sheets live in the URL so a refresh
 * keeps the screen and W9 can deep-link straight into a business (or its
 * approval dialog).
 */
export function useUsersUrlState(): UsersUrlState {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const tab = useMemo(
    () =>
      parseOptional(usersTabSchema, searchParams.get("tab")) ?? "businesses",
    [searchParams],
  );
  const status = useMemo(
    () =>
      parseOptional(businessDerivedStatusSchema, searchParams.get("status")),
    [searchParams],
  );
  const accessStatus = useMemo(
    () => parseOptional(userAccessStatusSchema, searchParams.get("access")),
    [searchParams],
  );
  const availability = useMemo(
    () =>
      parseOptional(workerAvailabilitySchema, searchParams.get("availability")),
    [searchParams],
  );
  const businessSection = useMemo(
    () =>
      parseOptional(businessSheetSectionSchema, searchParams.get("section")) ??
      null,
    [searchParams],
  );
  const approveRequested =
    parseOptional(businessDeepLinkActionSchema, searchParams.get("action")) ===
    "approve";

  const search = searchParams.get("q") ?? "";
  const businessId = searchParams.get("business");
  const customerId = searchParams.get("customer");

  const replaceParams = useCallback(
    (mutate: (params: URLSearchParams) => void) => {
      const params = new URLSearchParams(searchParams.toString());
      mutate(params);
      const query = params.toString();
      router.replace(query.length > 0 ? `${pathname}?${query}` : pathname, {
        scroll: false,
      });
    },
    [pathname, router, searchParams],
  );

  const setParam = useCallback(
    (key: string, value: string | undefined) =>
      replaceParams((params) => {
        if (value === undefined || value.length === 0) {
          params.delete(key);
          return;
        }
        params.set(key, value);
      }),
    [replaceParams],
  );

  return {
    tab,
    search,
    status,
    accessStatus,
    availability,
    businessId,
    businessSection,
    approveRequested,
    customerId,
    setTab: useCallback(
      (nextTab) =>
        replaceParams((params) => {
          params.set("tab", nextTab);
          // Filters are tab-specific; carrying them across tabs would
          // silently filter a list that has no such column.
          TAB_SCOPED_PARAMS.forEach((key) => params.delete(key));
          params.delete("q");
        }),
      [replaceParams],
    ),
    setSearch: useCallback((next) => setParam("q", next), [setParam]),
    setStatus: useCallback((next) => setParam("status", next), [setParam]),
    setAccessStatus: useCallback(
      (next) => setParam("access", next),
      [setParam],
    ),
    setAvailability: useCallback(
      (next) => setParam("availability", next),
      [setParam],
    ),
    clearFilters: useCallback(
      () =>
        replaceParams((params) => {
          ["q", "status", "access", "availability"].forEach((key) =>
            params.delete(key),
          );
        }),
      [replaceParams],
    ),
    openBusiness: useCallback(
      (nextBusinessId, section) =>
        replaceParams((params) => {
          params.set("business", nextBusinessId);
          if (section) {
            params.set("section", section);
          } else {
            params.delete("section");
          }
        }),
      [replaceParams],
    ),
    closeBusiness: useCallback(
      () =>
        replaceParams((params) => {
          params.delete("business");
          params.delete("section");
          params.delete("action");
        }),
      [replaceParams],
    ),
    clearApproveRequest: useCallback(
      () => replaceParams((params) => params.delete("action")),
      [replaceParams],
    ),
    openCustomer: useCallback(
      (nextCustomerId) =>
        replaceParams((params) => params.set("customer", nextCustomerId)),
      [replaceParams],
    ),
    closeCustomer: useCallback(
      () => replaceParams((params) => params.delete("customer")),
      [replaceParams],
    ),
  };
}
