"use client";

import { useRef, useState } from "react";
import { SearchIcon, XIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { prefersReducedMotion } from "~/components/motion";
import { SearchClearGhost } from "~/components/search-clear-ghost";
import { Input } from "~/components/ui/input";
import { cn } from "~/lib/utils";

export type SearchInputProps = {
  value: string;
  onValueChange: (value: string) => void;
  placeholder: string;
  className?: string;
};

type Ghost = { id: number; text: string };

/**
 * Search field with its own clear button. The button fades/scales in once
 * there is something to clear; clearing drops the old text out and returns
 * focus to the field so the next query can be typed straight away.
 */
export function SearchInput({
  value,
  onValueChange,
  placeholder,
  className,
}: SearchInputProps) {
  const t = useTranslations("common.search");
  const inputRef = useRef<HTMLInputElement>(null);
  const [ghost, setGhost] = useState<Ghost | null>(null);
  const hasValue = value.length > 0;

  function handleClear() {
    if (!prefersReducedMotion()) {
      setGhost({ id: Date.now(), text: value });
    }

    onValueChange("");
    inputRef.current?.focus();
  }

  return (
    <div className={cn("relative min-w-0", className)}>
      <SearchIcon
        aria-hidden="true"
        className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
      />
      <Input
        ref={inputRef}
        type="search"
        value={value}
        onChange={(event) => onValueChange(event.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="pr-9 pl-9 [&::-webkit-search-cancel-button]:appearance-none"
      />
      {ghost ? (
        <SearchClearGhost
          key={ghost.id}
          text={ghost.text}
          onDone={() => setGhost(null)}
        />
      ) : null}
      <button
        type="button"
        onClick={handleClear}
        aria-label={t("clear")}
        aria-hidden={!hasValue}
        tabIndex={hasValue ? 0 : -1}
        data-visible={hasValue}
        className="text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 absolute top-1/2 right-1 flex size-7 -translate-y-1/2 items-center justify-center rounded-sm transition-[opacity,scale,color] duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] outline-none focus-visible:ring-[3px] active:scale-[0.97] data-[visible=false]:pointer-events-none data-[visible=false]:scale-75 data-[visible=false]:opacity-0 motion-reduce:transition-none"
      >
        <XIcon aria-hidden="true" className="size-4" />
      </button>
    </div>
  );
}
