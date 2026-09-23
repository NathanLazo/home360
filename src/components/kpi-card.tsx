import type { Format } from "@number-flow/react";
import type { LucideIcon } from "lucide-react";

import { KpiNumber } from "~/components/kpi-number";

import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { cn } from "~/lib/utils";

export type KpiCardProps = {
  label: string;
  value: string;
  delta?: {
    text: string;
    trend: "up" | "down" | "neutral";
  };
  icon?: LucideIcon;
  /**
   * Raw figure behind `value`. When present the number rolls to its new value
   * on change instead of swapping text; `value` stays the first-paint text.
   */
  numeric?: {
    value: number;
    format: Format;
  };
};

const deltaClasses: Record<
  NonNullable<KpiCardProps["delta"]>["trend"],
  string
> = {
  up: "text-emerald-700",
  down: "text-destructive",
  neutral: "text-muted-foreground",
};

export function KpiCard({
  label,
  value,
  delta,
  icon: Icon,
  numeric,
}: KpiCardProps) {
  return (
    <Card className="ease-ui transition-[border-color,box-shadow] duration-150 hover:shadow-sm">
      <CardHeader>
        <CardTitle className="text-muted-foreground text-sm">{label}</CardTitle>
        {Icon ? (
          <CardAction>
            <Icon aria-hidden="true" className="text-muted-foreground size-4" />
          </CardAction>
        ) : null}
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        <p className="font-mono text-2xl font-semibold tracking-tight tabular-nums">
          {numeric ? (
            <KpiNumber
              value={numeric.value}
              format={numeric.format}
              fallback={value}
            />
          ) : (
            value
          )}
        </p>
        {delta ? (
          <p className={cn("text-xs font-medium", deltaClasses[delta.trend])}>
            {delta.text}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
