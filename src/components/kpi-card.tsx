import type { Format } from "@number-flow/react";
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { KpiValue } from "~/components/kpi-value";
import { cn } from "~/lib/utils";

export type KpiCardProps = {
  label: string;
  /**
   * Pre-formatted figure (or any node, e.g. a custom animated number);
   * rendered as-is when `numeric` is not provided.
   */
  value: ReactNode;
  /**
   * Raw number + Intl format. When present the figure rolls to its new value
   * on in-place updates instead of swapping abruptly.
   */
  numeric?: {
    value: number;
    format?: Format;
  };
  delta?: {
    text: string;
    trend: "up" | "down" | "neutral";
  };
  icon?: LucideIcon;
};

const deltaClasses: Record<
  NonNullable<KpiCardProps["delta"]>["trend"],
  string
> = {
  up: "text-success-deep",
  down: "text-error-deep",
  neutral: "text-muted-foreground",
};

export function KpiCard({
  label,
  value,
  numeric,
  delta,
  icon: Icon,
}: KpiCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-muted-foreground text-copy-sm font-medium">
          {label}
        </CardTitle>
        {Icon ? (
          <CardAction>
            <Icon aria-hidden="true" className="text-muted-foreground size-4" />
          </CardAction>
        ) : null}
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        <p className="text-display-md font-mono tabular-nums">
          {numeric ? (
            <KpiValue value={numeric.value} format={numeric.format} />
          ) : (
            value
          )}
        </p>
        {delta ? (
          <p
            className={cn(
              "text-label font-mono tabular-nums",
              deltaClasses[delta.trend],
            )}
          >
            {delta.text}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
