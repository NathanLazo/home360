"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * A boolean that turns itself off after `durationMs` — the "copied" / "saved"
 * beat that confirms an action and then gets out of the way. Re-raising it
 * restarts the timer.
 */
export function useTransientFlag(durationMs: number): [boolean, () => void] {
  const [active, setActive] = useState(false);
  const timerRef = useRef<number | null>(null);

  const raise = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
    }

    setActive(true);
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      setActive(false);
    }, durationMs);
  }, [durationMs]);

  useEffect(
    () => () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
      }
    },
    [],
  );

  return [active, raise];
}
