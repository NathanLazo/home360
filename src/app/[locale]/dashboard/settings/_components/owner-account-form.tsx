"use client";

import { useState, type FormEvent } from "react";
import { LoaderCircleIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { updateOwnerSchema } from "./settings.schema";
import type { MutationOutcome } from "./use-settings-mutations";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";

/**
 * Independent submit from the commercial profile: the owner account stays
 * editable for a business that is not ACTIVE yet.
 */
export function OwnerAccountForm({
  ownerName,
  ownerEmail,
  saving,
  onSubmit,
}: {
  ownerName: string;
  ownerEmail: string | null;
  saving: boolean;
  onSubmit: (input: { ownerName: string }) => Promise<MutationOutcome>;
}) {
  const t = useTranslations("dashboard.settings.account");
  const [value, setValue] = useState(ownerName);
  const [error, setError] = useState<string | null>(null);
  const isDirty = value !== ownerName;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = updateOwnerSchema.safeParse({ ownerName: value });

    if (!parsed.success) {
      setError(t("nameError"));
      window.requestAnimationFrame(() =>
        document.getElementById("settings-owner-name")?.focus(),
      );
      return;
    }

    setError(null);
    await onSubmit(parsed.data);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
      <div className="flex flex-col gap-2">
        <Label htmlFor="settings-owner-name">{t("nameLabel")}</Label>
        <Input
          id="settings-owner-name"
          name="ownerName"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          autoComplete="name"
          aria-invalid={Boolean(error)}
          aria-describedby={
            error ? "settings-owner-name-error" : "settings-owner-email"
          }
          disabled={saving}
        />
        {error ? (
          <p
            id="settings-owner-name-error"
            className="text-destructive text-sm"
          >
            {error}
          </p>
        ) : (
          <p
            id="settings-owner-email"
            className="text-muted-foreground text-sm"
          >
            {t("emailNote", { email: ownerEmail ?? t("emailUnavailable") })}
          </p>
        )}
      </div>

      <div className="flex justify-end">
        <Button
          type="submit"
          disabled={saving || !isDirty}
          className="min-h-11 sm:min-h-10"
        >
          {saving ? (
            <LoaderCircleIcon
              aria-hidden="true"
              className="animate-spin motion-reduce:animate-none"
            />
          ) : null}
          {t("save")}
        </Button>
      </div>
    </form>
  );
}
