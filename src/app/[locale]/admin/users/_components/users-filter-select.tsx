"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";

const ALL_VALUES = "all";

export type UsersFilterSelectProps<TValue extends string> = {
  value: TValue | undefined;
  options: readonly TValue[];
  /** Narrows the raw select value with the same schema the server uses. */
  parse: (value: string) => TValue;
  optionLabel: (option: TValue) => string;
  allLabel: string;
  ariaLabel: string;
  onChange: (value: TValue | undefined) => void;
};

/** One enum filter with an explicit "all" entry, shared by the three tabs. */
export function UsersFilterSelect<TValue extends string>({
  value,
  options,
  parse,
  optionLabel,
  allLabel,
  ariaLabel,
  onChange,
}: UsersFilterSelectProps<TValue>) {
  return (
    <Select
      value={value ?? ALL_VALUES}
      onValueChange={(next) =>
        onChange(next === ALL_VALUES ? undefined : parse(next))
      }
    >
      <SelectTrigger
        className="min-h-11 w-48 sm:min-h-10"
        aria-label={ariaLabel}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL_VALUES}>{allLabel}</SelectItem>
        {options.map((option) => (
          <SelectItem key={option} value={option}>
            {optionLabel(option)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
