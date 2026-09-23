"use client";

import { useTranslations } from "next-intl";

import { ExpandableText } from "./expandable-text";

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
        <blockquote className="mt-1">
          <ExpandableText
            text={customerArgument}
            expandLabel={t("expand")}
            collapseLabel={t("collapse")}
            className="text-muted-foreground text-sm text-pretty"
          />
        </blockquote>
      </figure>
      <figure className="border-l-2 border-zinc-300 pl-4">
        <figcaption className="text-xs font-semibold tracking-wide uppercase">
          {t("business")}
        </figcaption>
        <blockquote className="mt-1">
          {businessArgument === null ? (
            <p className="text-muted-foreground text-sm italic">
              {t("noBusinessAnswer")}
            </p>
          ) : (
            <ExpandableText
              text={businessArgument}
              expandLabel={t("expand")}
              collapseLabel={t("collapse")}
              className="text-muted-foreground text-sm text-pretty"
            />
          )}
        </blockquote>
      </figure>
    </section>
  );
}
