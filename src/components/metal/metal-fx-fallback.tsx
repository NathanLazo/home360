import type { CSSProperties, ReactNode } from "react";

type MetalFxFallbackProps = {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
};

/**
 * Same markup `metal-fx` renders without WebGL2 (`div.metal-fx-fallback`).
 *
 * `MetalFx` decides WebGL2 support during render (`useMemo(isMetalFxSupported)`):
 * `false` on the server, `true` in a capable browser. Rendered directly, the
 * server sends the fallback wrapper and the client hydrates a canvas-based
 * tree, which throws React #418 ("HTML") on every page carrying metal. Render
 * this until `useHydrated()` is true, then mount the live `MetalFx`.
 */
export function MetalFxFallback({
  children,
  className,
  style,
}: MetalFxFallbackProps) {
  return (
    <div
      className={
        className ? `metal-fx-fallback ${className}` : "metal-fx-fallback"
      }
      data-metal-fx-unsupported=""
      style={{ display: "inline-flex", ...style }}
    >
      {children}
    </div>
  );
}
