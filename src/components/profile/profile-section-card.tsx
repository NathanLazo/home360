"use client";

import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

import type { ProfileSectionId } from "./profile.types";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";

export function profileSectionTitleId(id: ProfileSectionId): string {
  return `profile-${id}-title`;
}

/**
 * One anchored section of the profile: the `id` is the deep-link target
 * (`#billing`) and the scroll target of the section nav. `tabIndex={-1}` lets
 * the nav move focus here after scrolling, so keyboard users land where the
 * eye did; `scroll-mt-24` clears the sticky shell header.
 */
export function ProfileSectionCard({
  id,
  title,
  description,
  icon: Icon,
  action,
  children,
}: {
  id: ProfileSectionId;
  title: string;
  description: string;
  icon: LucideIcon;
  /** Trailing header slot (a chip, a link); replaces the section icon. */
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Card
      id={id}
      role="region"
      aria-labelledby={profileSectionTitleId(id)}
      tabIndex={-1}
      className="focus-visible:ring-ring scroll-mt-24 outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
    >
      <CardHeader>
        <CardTitle>
          <h2 id={profileSectionTitleId(id)} className="text-display-sm">
            {title}
          </h2>
        </CardTitle>
        <CardAction>
          {action ?? (
            <Icon aria-hidden="true" className="text-muted-foreground" />
          )}
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <p className="text-muted-foreground text-copy-sm">{description}</p>
        {children}
      </CardContent>
    </Card>
  );
}
