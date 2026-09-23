import { ArrowRightIcon } from "lucide-react";

import { Link } from "~/i18n/navigation";

/** Quiet "view all" affordance that sits in a `SectionHeading` action slot. */
export function SectionLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="text-muted-foreground hover:text-foreground focus-visible:ring-ring group text-copy-sm inline-flex min-h-9 items-center gap-1 rounded-sm font-medium transition-colors duration-150 ease-out focus-visible:ring-2 focus-visible:outline-none"
    >
      {label}
      <ArrowRightIcon
        aria-hidden="true"
        className="size-4 transition-transform duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:translate-x-0.5 motion-reduce:transition-none"
      />
    </Link>
  );
}
