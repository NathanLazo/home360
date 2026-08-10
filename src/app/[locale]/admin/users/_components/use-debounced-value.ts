"use client";

import { useEffect, useState } from "react";

/**
 * Keeps the input responsive while the server-side search only re-runs once
 * typing pauses.
 */
export function useDebouncedValue<TValue>(
  value: TValue,
  delayMs: number,
): TValue {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timeout = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timeout);
  }, [value, delayMs]);

  return debounced;
}
