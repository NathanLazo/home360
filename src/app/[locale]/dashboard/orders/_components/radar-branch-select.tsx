"use client";

import { useTranslations } from "next-intl";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";

export type RadarBranchOption = { id: string; name: string };

/**
 * Radar origin picker: only ACTIVE branches with coordinates can anchor the
 * radius. Hidden when there is a single candidate.
 */
export function RadarBranchSelect({
  branches,
  value,
  onChange,
}: {
  branches: RadarBranchOption[];
  value: string | undefined;
  onChange: (branchId: string) => void;
}) {
  const t = useTranslations("dashboard.requests.radar");

  if (branches.length < 2) return null;

  return (
    <Select value={value ?? ""} onValueChange={onChange}>
      <SelectTrigger
        className="w-full sm:w-56"
        aria-label={t("branchLabel")}
      >
        <SelectValue placeholder={t("branchPlaceholder")} />
      </SelectTrigger>
      <SelectContent>
        {branches.map((branch) => (
          <SelectItem key={branch.id} value={branch.id}>
            {branch.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
