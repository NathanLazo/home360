"use client";

import { useTranslations } from "next-intl";
import { UserAvatar } from "~/components/user-avatar";

export type DisputeParty = { id: string; name: string | null };

/** Who argues: their bot, role and name, above the quoted argument. */
export function DisputePartyCaption({
  party,
  role,
}: {
  party: DisputeParty;
  role: string;
}) {
  const t = useTranslations("admin.disputes");
  const name = party.name ?? t("unknownParty");

  return (
    <figcaption className="flex items-center gap-2">
      <UserAvatar seed={party.id} name={name} size={24} />
      <span className="text-label font-mono font-medium tracking-wide uppercase">
        {role}
      </span>
      <span className="text-muted-foreground min-w-0 truncate text-xs">
        {name}
      </span>
    </figcaption>
  );
}
