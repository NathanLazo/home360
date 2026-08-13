"use client";

import { useEffect, useState } from "react";

/**
 * Keeps the search input responsive while the server-side query only re-runs
 * once typing pauses. Local to the corporate module: `_components` folders do
 * not import across sibling admin modules (roger-arq).
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
