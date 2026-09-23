import { Badge } from "~/components/ui/badge";
import { cn } from "~/lib/utils";

export type StatusBadgeVariant =
  "success" | "warning" | "info" | "muted" | "destructive";

export type StatusBadgeProps<TStatus extends string> = {
  status: TStatus;
  variantMap: Record<TStatus, StatusBadgeVariant>;
  label: string;
};

// Token families from DESIGN.md §2: soft fill + deep text (AA ≥ 4.5:1).
const variantClasses: Record<StatusBadgeVariant, string> = {
  success: "border-transparent bg-success-soft text-success-deep",
  warning: "border-transparent bg-warning-soft text-warning-deep",
  info: "border-transparent bg-link-soft text-link-deep",
  muted: "border-hairline bg-canvas-soft text-muted-foreground",
  destructive: "border-transparent bg-error-soft text-error-deep",
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
