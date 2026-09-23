"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { ADMIN_DIALOG_EXIT_MS, ADMIN_SUCCESS_HOLD_MS } from "./admin-motion";

export type SuccessBeat = {
  succeeded: boolean;
  /** Shows the success state, holds it briefly, then runs `then`. */
  celebrate: (then: () => void) => void;
};

/**
 * A short, deliberate pause between "the server said yes" and "the dialog is
 * gone", so the admin sees the check land on the button they pressed.
 */
export function useSuccessBeat(): SuccessBeat {
  const [succeeded, setSucceeded] = useState(false);
  const timers = useRef<number[]>([]);

  const clearTimers = useCallback(() => {
    timers.current.forEach((id) => window.clearTimeout(id));
    timers.current = [];
  }, []);

  useEffect(() => clearTimers, [clearTimers]);

  const celebrate = useCallback(
    (then: () => void) => {
      clearTimers();
      setSucceeded(true);
      timers.current.push(
        window.setTimeout(() => {
          then();
          timers.current.push(
            window.setTimeout(() => setSucceeded(false), ADMIN_DIALOG_EXIT_MS),
          );
        }, ADMIN_SUCCESS_HOLD_MS),
      );
    },
    [clearTimers],
  );

  return { succeeded, celebrate };
}
