"use client";

import { LinkIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import {
  useReadOnlyNotice,
  useSubscriptionAccess,
} from "~/components/dashboard/subscription-access-context";
import { Button } from "~/components/ui/button";
import { Link } from "~/i18n/navigation";

/**
 * The home's key action: charging a customer through a protected payment
 * link. Opens the create dialog on the payments screen (`?create=link`).
 *
 * While the account cannot mutate (pending approval, suspended, canceled
 * subscription) the action is shown disabled with the reason and without the
 * beam: the tint means "the flow continues here", which is not true yet.
 */
export function HomePrimaryAction() {
  const t = useTranslations("dashboard.home");
  const { isReadOnly } = useSubscriptionAccess();
  const readOnlyNotice = useReadOnlyNotice();

  if (isReadOnly) {
    return (
      <Button type="button" disabled title={readOnlyNotice}>
        <LinkIcon aria-hidden="true" />
        {t("primaryAction")}
      </Button>
    );
  }

  return (
    <Button asChild beam>
      <Link href="/dashboard/payments?create=link">
        <LinkIcon aria-hidden="true" />
        {t("primaryAction")}
      </Link>
    </Button>
  );
}
