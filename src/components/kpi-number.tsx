"use client";

import { useEffect, useState } from "react";
import NumberFlow, { type Format } from "@number-flow/react";
import { useLocale } from "next-intl";

export type KpiNumberProps = {
  value: number;
  format: Format;
  /** Server/first-paint text, identical to what NumberFlow will render. */
  fallback: string;
};

function isNumberFlowDefined(): boolean {
  return (
    typeof customElements !== "undefined" &&
    Boolean(customElements.get("number-flow-react"))
  );
}

/**
 * KPI figure that rolls digit by digit when the value changes (branch switch,
 * refetch), so the eye sees *which* figures moved. First paint is the static
 * formatted text, so there is no entrance animation and no layout shift.
 * NumberFlow honours `prefers-reduced-motion` on its own and then swaps the
 * value instantly.
 */
export function KpiNumber({ value, format, fallback }: KpiNumberProps) {
  const locale = useLocale();
  const [ready, setReady] = useState(isNumberFlowDefined);

  useEffect(() => {
    if (ready) {
      return;
    }

    let cancelled = false;
    void customElements.whenDefined("number-flow-react").then(() => {
      if (!cancelled) {
        setReady(true);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [ready]);

  if (!ready) {
    return <>{fallback}</>;
  }

  return (
    <NumberFlow
      value={value}
      format={format}
      locales={locale}
      transformTiming={{ duration: 300, easing: "cubic-bezier(0.2, 0, 0, 1)" }}
      spinTiming={{ duration: 300, easing: "cubic-bezier(0.2, 0, 0, 1)" }}
      opacityTiming={{ duration: 200, easing: "ease-out" }}
    />
  );
}
