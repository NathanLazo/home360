import type { ReactNode } from "react";

import { ADMIN_EYEBROW_CLASS } from "../../_components/admin-surface";

/** Eyebrow-titled block inside a W10 detail sheet. */
export function SheetDetailSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <h3 className={ADMIN_EYEBROW_CLASS}>{title}</h3>
      {children}
    </section>
  );
}
