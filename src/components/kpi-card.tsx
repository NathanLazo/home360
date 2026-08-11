import type { LucideIcon } from "lucide-react";

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
};

const deltaClasses: Record<
  NonNullable<KpiCardProps["delta"]>["trend"],
  string
> = {
  up: "text-emerald-700",
  down: "text-destructive",
  neutral: "text-muted-foreground",
};

export function KpiCard({ label, value, delta, icon: Icon }: KpiCardProps) {
  return (
    <Card className="transition-[border-color,box-shadow] duration-150 ease-out hover:shadow-sm">
      <CardHeader>
        <CardTitle className="text-muted-foreground text-sm">{label}</CardTitle>
        {Icon ? (
          <CardAction>
            <Icon aria-hidden="true" className="text-muted-foreground size-4" />
          </CardAction>
        ) : null}
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        <p className="font-mono text-2xl font-semibold tracking-tight">
          {value}
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
