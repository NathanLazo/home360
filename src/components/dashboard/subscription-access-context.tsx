"use client";

import { createContext, useContext, useEffect, type ReactNode } from "react";

import type { SubscriptionStatus } from "../../../generated/prisma";
import { api } from "~/trpc/react";

type SubscriptionAccessContextValue = {
  status: SubscriptionStatus | null;
  /** `true` only for `CANCELED`: the account is degraded to read-only. */
  isReadOnly: boolean;
};

const SubscriptionAccessContext =
  createContext<SubscriptionAccessContextValue | null>(null);

const REFRESH_INTERVAL_MS = 60_000;

/**
 * Shares the subscription state with every dashboard module so a mutable action
 * is not offered when it is guaranteed to fail.
 *
 * This is UX only. `activeBusinessProcedure` (F4-07) remains the authority: a
 * forced mutation on a canceled subscription still returns 403.
 */
export function SubscriptionAccessProvider({
  initialStatus,
  children,
}: {
  initialStatus: SubscriptionStatus | null;
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

  return (
    <SubscriptionAccessContext.Provider
      value={{ status, isReadOnly: status === "CANCELED" }}
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
      isReadOnly: false,
    }
  );
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
