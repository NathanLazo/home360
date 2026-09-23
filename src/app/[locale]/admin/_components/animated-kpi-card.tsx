"use client";

import type { LucideIcon } from "lucide-react";
import type { Format } from "@number-flow/react";

import { AnimatedNumber } from "./animated-number";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { cn } from "~/lib/utils";

export type KpiTrend = "up" | "down" | "neutral";

export type AnimatedKpiCardProps = {
  label: string;
  value: number;
  format?: Format;
  delta?: { text: string; trend: KpiTrend };
  icon?: LucideIcon;
};

const deltaClasses: Record<KpiTrend, string> = {
  up: "text-emerald-700",
  down: "text-destructive",
  neutral: "text-muted-foreground",
};

/**
 * Admin KPI tile whose figure transitions with NumberFlow. It mirrors the
 * shared `KpiCard` anatomy (label · icon · figure · delta) so both read as one
 * system; only the value slot is numeric instead of a pre-formatted string.
 */
export function AnimatedKpiCard({
  label,
  value,
  format,
  delta,
  icon: Icon,
}: AnimatedKpiCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-muted-foreground text-sm font-medium">
          {label}
        </CardTitle>
        {Icon ? (
          <CardAction>
            <Icon aria-hidden="true" className="text-muted-foreground size-4" />
          </CardAction>
        ) : null}
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        <p className="font-mono text-2xl font-semibold tracking-tight">
          <AnimatedNumber value={value} format={format} />
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
