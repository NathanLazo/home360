"use client";

import { useEffect, useRef, useState } from "react";

/** Content-box size of an element, kept current with a ResizeObserver. */
export function useElementSize<TElement extends HTMLElement>() {
  const ref = useRef<TElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return;
      const { width, height } = entry.contentRect;
      setSize((previous) =>
        previous.width === Math.round(width) &&
        previous.height === Math.round(height)
          ? previous
          : { width: Math.round(width), height: Math.round(height) },
      );
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return { ref, ...size };
}
