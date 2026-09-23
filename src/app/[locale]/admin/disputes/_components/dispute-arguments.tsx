"use client";

import { useTranslations } from "next-intl";

import {
  DisputePartyCaption,
  type DisputeParty,
} from "./dispute-party-caption";
import { ExpandableText } from "./expandable-text";

export function DisputeArguments({
  customer,
  business,
  customerArgument,
  businessArgument,
}: {
  customer: DisputeParty;
  business: DisputeParty;
  customerArgument: string;
  businessArgument: string | null;
}) {
  const t = useTranslations("admin.disputes.arguments");

  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-muted-foreground text-label font-mono font-medium tracking-wide uppercase">
        {t("title")}
      </h3>
      <figure className="border-ink border-l-2 pl-4">
        <DisputePartyCaption party={customer} role={t("customer")} />
        <blockquote className="mt-2">
          <ExpandableText
            text={customerArgument}
            expandLabel={t("expand")}
            collapseLabel={t("collapse")}
            className="text-muted-foreground text-copy-sm text-pretty"
          />
        </blockquote>
      </figure>
      <figure className="border-hairline-strong border-l-2 pl-4">
        <DisputePartyCaption party={business} role={t("business")} />
        <blockquote className="mt-2">
          {businessArgument === null ? (
            <p className="text-muted-foreground text-copy-sm italic">
              {t("noBusinessAnswer")}
            </p>
          ) : (
            <ExpandableText
              text={businessArgument}
              expandLabel={t("expand")}
              collapseLabel={t("collapse")}
              className="text-muted-foreground text-copy-sm text-pretty"
            />
          )}
        </blockquote>
      </figure>
    </section>
  );
}
