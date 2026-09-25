"use client";

import { useFormatter, useTranslations } from "next-intl";

import type { ProfileSummary } from "./profile.types";
import { UserAvatar } from "~/components/user-avatar";

/**
 * Who this profile belongs to. The panel identity (sidebar, breadcrumb) comes
 * from the shell; this header only states the person: avatar, name, role chip
 * and the verifiable facts (email, member since) in mono.
 */
export function ProfileIdentityHeader({
  profile,
}: {
  profile: ProfileSummary;
}) {
  const t = useTranslations("profile.identity");
  const roles = useTranslations("common.userMenu.roles");
  const format = useFormatter();
  const name = profile.name?.trim() ? profile.name : t("nameFallback");

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
      <UserAvatar
        seed={profile.id}
        name={name}
        image={profile.image}
        size={64}
        className="shadow-hairline rounded-full"
      />
      <div className="flex min-w-0 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <p className="text-display-md truncate">{name}</p>
          <span className="bg-metal text-on-metal rounded-pill px-2.5 py-0.5 text-xs font-medium">
            {roles(profile.role)}
          </span>
        </div>
        <p className="text-muted-foreground text-label font-mono">
          <span className="break-all">
            {profile.email ?? t("emailUnavailable")}
          </span>
          <span aria-hidden="true"> · </span>
          <span>
            {t("memberSince", {
              date: format.dateTime(profile.createdAt, { dateStyle: "medium" }),
            })}
          </span>
        </p>
      </div>
    </div>
  );
}
