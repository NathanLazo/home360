"use client";

import { createContext, useContext, useEffect, type ReactNode } from "react";
import { useTranslations } from "next-intl";

import type { BusinessStatus, SubscriptionStatus } from "@generated/prisma";
import { api } from "~/trpc/react";

/**
 * Why the dashboard is read-only, mirroring the two checks of
 * `activeBusinessProcedure`: the business must be `ACTIVE` (admin approval)
 * and its subscription must not be `CANCELED`. The business status wins
 * because it is the first check the server applies.
 */
export type ReadOnlyReason =
  | "businessPending"
  | "businessSuspended"
  | "businessRejected"
  | "subscriptionCanceled";

type SubscriptionAccessContextValue = {
  status: SubscriptionStatus | null;
  businessStatus: BusinessStatus | null;
  /** `true` when any mutation is guaranteed to be rejected by the server. */
  isReadOnly: boolean;
  readOnlyReason: ReadOnlyReason | null;
};

const SubscriptionAccessContext =
  createContext<SubscriptionAccessContextValue | null>(null);

const REFRESH_INTERVAL_MS = 60_000;

const BUSINESS_READ_ONLY_REASON: Record<
  Exclude<BusinessStatus, "ACTIVE">,
  ReadOnlyReason
> = {
  PENDING: "businessPending",
  SUSPENDED: "businessSuspended",
  REJECTED: "businessRejected",
};

export function resolveReadOnlyReason(
  businessStatus: BusinessStatus | null,
  subscriptionStatus: SubscriptionStatus | null,
): ReadOnlyReason | null {
  if (businessStatus !== null && businessStatus !== "ACTIVE") {
    return BUSINESS_READ_ONLY_REASON[businessStatus];
  }

  return subscriptionStatus === "CANCELED" ? "subscriptionCanceled" : null;
}

/**
 * Single source of truth for "can this business mutate anything?", shared by
 * every dashboard module so a mutable action is not offered when it is
 * guaranteed to fail.
 *
 * This is UX only. `activeBusinessProcedure` (F4-07) remains the authority: a
 * forced mutation on a pending business or a canceled subscription still
 * returns 403.
 */
export function SubscriptionAccessProvider({
  initialStatus,
  businessStatus,
  children,
}: {
  initialStatus: SubscriptionStatus | null;
  /**
   * Resolved by the dashboard layout on every server render. Approval or
   * suspension is rare and admin-driven, so the next navigation/refresh picks
   * it up; a stale value can only keep actions disabled for a pending account.
   */
  businessStatus: BusinessStatus | null;
  children: ReactNode;
}) {
  // Refetching on focus and on a sober interval reflects a Stripe webhook
  // without a page reload.
  const currentQuery = api.subscription.getCurrent.useQuery(undefined, {
    refetchOnWindowFocus: true,
    refetchInterval: REFRESH_INTERVAL_MS,
  });

  const response = currentQuery.data;
  // A failed or errored read keeps the server-rendered status: a network
  // problem must never *enable* an action.
  const status =
    response?.error === null && response.result
      ? response.result.status
      : initialStatus;
  const readOnlyReason = resolveReadOnlyReason(businessStatus, status);

  return (
    <SubscriptionAccessContext.Provider
      value={{
        status,
        businessStatus,
        isReadOnly: readOnlyReason !== null,
        readOnlyReason,
      }}
    >
      {children}
    </SubscriptionAccessContext.Provider>
  );
}

/**
 * Outside the provider the dashboard is not degraded, which keeps components
 * usable in isolation without pretending an account is blocked.
 */
export function useSubscriptionAccess(): SubscriptionAccessContextValue {
  return (
    useContext(SubscriptionAccessContext) ?? {
      status: null,
      businessStatus: null,
      isReadOnly: false,
      readOnlyReason: null,
    }
  );
}

/**
 * Translated explanation for a disabled action (tooltip / `title`), matching
 * the reason the server would reject it. `undefined` while actions are enabled.
 */
export function useReadOnlyNotice(): string | undefined {
  const { readOnlyReason } = useSubscriptionAccess();
  const t = useTranslations("dashboard.subscription.readOnly.reasons");

  return readOnlyReason ? t(readOnlyReason) : undefined;
}

/**
 * Closes an open sheet or dialog when the account becomes read-only, dropping
 * the local draft instead of letting the user finish a form that the server
 * will reject. It only closes: no mutation is ever fired from an effect, and a
 * request already in flight is left to resolve on the server's terms.
 */
export function useCloseWhenReadOnly(
  open: boolean,
  onOpenChange: (open: boolean) => void,
): void {
  const { isReadOnly } = useSubscriptionAccess();

  useEffect(() => {
    if (open && isReadOnly) {
      onOpenChange(false);
    }
  }, [open, isReadOnly, onOpenChange]);
}
