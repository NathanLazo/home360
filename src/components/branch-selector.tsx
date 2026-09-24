"use client";

import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { usePathname, useRouter } from "~/i18n/navigation";
import { cn } from "~/lib/utils";

const ALL_BRANCHES_VALUE = "__all_branches__";

export type BranchSelectorProps = {
  branches: Array<{ id: string; name: string }>;
  className?: string;
  /** `sm` (28 px) for the panel header row; `default` (32 px) elsewhere. */
  size?: "sm" | "default";
};

export function BranchSelector({
  branches,
  className,
  size = "default",
}: BranchSelectorProps) {
  const t = useTranslations("dashboard.branchSelector");
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const branchParam = searchParams.get("branch");
  const selectedBranch = branches.some(({ id }) => id === branchParam)
    ? branchParam
    : ALL_BRANCHES_VALUE;

  function selectBranch(nextBranch: string) {
    const nextSearchParams = new URLSearchParams(searchParams.toString());

    if (nextBranch === ALL_BRANCHES_VALUE) {
      nextSearchParams.delete("branch");
    } else {
      nextSearchParams.set("branch", nextBranch);
    }

    const query = nextSearchParams.toString();
    router.replace(query.length > 0 ? `${pathname}?${query}` : pathname, {
      scroll: false,
    });
  }

  return (
    <Select
      value={selectedBranch ?? ALL_BRANCHES_VALUE}
      onValueChange={selectBranch}
    >
      <SelectTrigger
        size={size}
        aria-label={t("label")}
        className={cn("w-full min-w-0 sm:w-auto sm:min-w-48", className)}
      >
        <SelectValue placeholder={t("all")} />
      </SelectTrigger>
      <SelectContent glass align="end">
        <SelectGroup>
          <SelectItem value={ALL_BRANCHES_VALUE}>{t("all")}</SelectItem>
          {branches.map((branch) => (
            <SelectItem key={branch.id} value={branch.id}>
              {branch.name}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}
