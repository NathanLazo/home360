"use client";

import { useCallback, useMemo, useRef } from "react";
import { toast } from "sonner";

export type MutationFeedback = {
  /** Opens a loading toast for `key`; the follow-up replaces it in place. */
  start: (key: string, message: string) => void;
  success: (key: string, message: string) => void;
  error: (key: string, message: string) => void;
};

/**
 * One toast per mutation that morphs loading → success/error instead of
 * stacking two: the admin sees the request was heard the moment they click,
 * and the outcome lands in the same spot. Keys isolate concurrent mutations
 * owned by the same hook.
 */
export function useMutationFeedback(): MutationFeedback {
  const toastIds = useRef(new Map<string, string | number>());

  const take = useCallback((key: string) => {
    const id = toastIds.current.get(key);
    toastIds.current.delete(key);
    return id;
  }, []);

  return useMemo(
    () => ({
      start: (key, message) => {
        toastIds.current.set(key, toast.loading(message));
      },
      success: (key, message) => {
        toast.success(message, { id: take(key) });
      },
      error: (key, message) => {
        toast.error(message, { id: take(key) });
      },
    }),
    [take],
  );
}
