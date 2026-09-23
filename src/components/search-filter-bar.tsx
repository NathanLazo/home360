"use client";

import type { ReactNode } from "react";

import { SearchInput } from "~/components/search-input";

export type SearchFilterBarProps = {
  searchValue: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder: string;
  children?: ReactNode;
};

export function SearchFilterBar({
  searchValue,
  onSearchChange,
  searchPlaceholder,
  children,
}: SearchFilterBarProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <SearchInput
        value={searchValue}
        onValueChange={onSearchChange}
        placeholder={searchPlaceholder}
        className="flex-1"
      />
      {children ? (
        <div className="flex flex-wrap items-center gap-2">{children}</div>
      ) : null}
    </div>
  );
}
