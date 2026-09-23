"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { WorkerInvitationForm } from "./worker-invitation-form";
import { WorkerInvitationInvalid } from "./worker-invitation-invalid";
import { WorkerInvitationSuccess } from "./worker-invitation-success";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";

export type WorkerInvitationCardProps = {
  logoMark: string;
  token: string | null;
  invitation: {
    workerName: string;
    businessName: string;
    email: string;
  } | null;
  locale: "es" | "en";
};

/** Invalid → form → success, in the same quiet card as reset-password. */
export function WorkerInvitationCard({
  logoMark,
  token,
  invitation,
  locale,
}: WorkerInvitationCardProps) {
  const t = useTranslations("auth.inviteWorker");
  const [acceptedEmail, setAcceptedEmail] = useState<string | null>(null);
  const [invalid, setInvalid] = useState(token === null || invitation === null);

  const title = acceptedEmail ? t("successTitle") : t("title");
  const description = acceptedEmail
    ? t("successDescription", { email: acceptedEmail })
    : invitation && !invalid
      ? t("description", { businessName: invitation.businessName })
      : null;

  return (
    <Card className="bg-canvas-soft w-full max-w-md rounded-2xl py-8 shadow-none">
      <CardHeader className="text-center">
        <div
          aria-hidden="true"
          className="bg-ink text-on-ink text-display-sm mx-auto mb-2 flex size-10 items-center justify-center rounded-md"
        >
          {logoMark}
        </div>
        <CardTitle>
          <h1 className="text-display-md text-balance">{title}</h1>
        </CardTitle>
        {description ? (
          <CardDescription className="text-pretty">
            {description}
          </CardDescription>
        ) : null}
      </CardHeader>
      <CardContent>
        {acceptedEmail ? <WorkerInvitationSuccess /> : null}
        {!acceptedEmail && (invalid || !token || !invitation) ? (
          <WorkerInvitationInvalid />
        ) : null}
        {!acceptedEmail && !invalid && token && invitation ? (
          <WorkerInvitationForm
            token={token}
            email={invitation.email}
            defaultName={invitation.workerName}
            locale={locale}
            onAccepted={setAcceptedEmail}
            onInvalidToken={() => setInvalid(true)}
          />
        ) : null}
      </CardContent>
    </Card>
  );
}
