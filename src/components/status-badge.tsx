import { Badge } from "~/components/ui/badge";
import { cn } from "~/lib/utils";

export type StatusBadgeVariant =
  "success" | "warning" | "info" | "muted" | "destructive";

export type StatusBadgeProps<TStatus extends string> = {
  status: TStatus;
  variantMap: Record<TStatus, StatusBadgeVariant>;
  label: string;
};

const variantClasses: Record<StatusBadgeVariant, string> = {
  success: "border-emerald-200 bg-emerald-50 text-emerald-700",
  warning: "border-amber-200 bg-amber-50 text-amber-800",
  info: "border-blue-200 bg-blue-50 text-blue-700",
  muted: "border-zinc-200 bg-zinc-100 text-zinc-600",
  destructive: "border-red-200 bg-red-50 text-red-700",
};

export function StatusBadge<TStatus extends string>({
  status,
  variantMap,
  label,
}: StatusBadgeProps<TStatus>) {
  return (
    <Badge
      variant="outline"
      data-status={status}
      className={cn("gap-1.5", variantClasses[variantMap[status]])}
    >
      <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
      {label}
    </Badge>
  );
}
