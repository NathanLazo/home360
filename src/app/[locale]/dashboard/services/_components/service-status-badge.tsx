import type { ServiceListItem } from "./service.types";
import { StatusBadge } from "~/components/status-badge";

const variants = {
  ACTIVE: "success",
  PAUSED: "warning",
} as const;

export function ServiceStatusBadge({
  status,
  label,
}: {
  status: ServiceListItem["status"];
  label: string;
}) {
  return <StatusBadge status={status} variantMap={variants} label={label} />;
}
