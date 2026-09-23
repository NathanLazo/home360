"use client";

import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";

export function SettingsSectionCard({
  id,
  title,
  description,
  icon: Icon,
  children,
}: {
  /** Anchor so other screens can deep-link, e.g. `/admin/settings#ai`. */
  id?: string;
  title: string;
  description: string;
  icon: LucideIcon;
  children: ReactNode;
}) {
  return (
    <Card id={id} className="scroll-mt-24">
      <CardHeader>
        <CardTitle>
          <h2 className="text-display-sm">{title}</h2>
        </CardTitle>
        <CardAction>
          <Icon aria-hidden="true" className="text-muted-foreground" />
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <p className="text-muted-foreground text-copy-sm">{description}</p>
        {children}
      </CardContent>
    </Card>
  );
}
