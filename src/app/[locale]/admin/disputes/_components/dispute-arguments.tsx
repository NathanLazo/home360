"use client";

import { useTranslations } from "next-intl";

export function DisputeArguments({
  customerArgument,
  businessArgument,
}: {
  customerArgument: string;
  businessArgument: string | null;
}) {
  const t = useTranslations("admin.disputes.arguments");

  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
        {t("title")}
      </h3>
      <figure className="border-l-2 border-zinc-900 pl-4">
        <figcaption className="text-xs font-semibold tracking-wide uppercase">
          {t("customer")}
        </figcaption>
        <blockquote className="text-muted-foreground mt-1 text-sm">
          {customerArgument}
        </blockquote>
      </figure>
      <figure className="border-l-2 border-zinc-300 pl-4">
        <figcaption className="text-xs font-semibold tracking-wide uppercase">
          {t("business")}
        </figcaption>
        <blockquote className="text-muted-foreground mt-1 text-sm">
          {businessArgument ?? t("noBusinessAnswer")}
        </blockquote>
      </figure>
    </section>
  );
}
