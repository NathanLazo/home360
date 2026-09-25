"use client";

import { useState, type FormEvent } from "react";
import { hasLocale, useLocale, useTranslations } from "next-intl";

import { ProfileFormStatus } from "./profile-form-status";
import { updateIdentitySchema } from "./profile.form-schema";
import {
  SAVED_FEEDBACK_MS,
  type MutationOutcome,
  type ProfileSummary,
} from "./profile.types";
import type { UpdateIdentityInput } from "~/schemas/profile/profile.schema";
import {
  SubmitStatusIcon,
  useErrorShake,
  useTransientFlag,
} from "~/components/motion";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { usePathname, useRouter } from "~/i18n/navigation";
import { routing } from "~/i18n/routing";

type Locale = (typeof routing.locales)[number];

const IDS = {
  name: "profile-name",
  nameError: "profile-name-error",
  email: "profile-email",
  emailNote: "profile-email-note",
  locale: "profile-locale",
  localeHint: "profile-locale-hint",
  role: "profile-role",
} as const;

function toLocale(value: string): Locale {
  return hasLocale(routing.locales, value) ? value : routing.defaultLocale;
}

/**
 * Name and preferred language, saved together (one submit, one toast). The
 * email and the role are shown read-only next to them: they are part of the
 * same identity even though this screen cannot change them.
 */
export function ProfileIdentityForm({
  profile,
  disabled,
  saving,
  onSubmit,
}: {
  profile: ProfileSummary;
  disabled: boolean;
  saving: boolean;
  onSubmit: (input: UpdateIdentityInput) => Promise<MutationOutcome>;
}) {
  const t = useTranslations("profile.account");
  const roles = useTranslations("common.userMenu.roles");
  const locales = useTranslations("common.localeSwitcher");
  const currentLocale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  const initialName = profile.name ?? "";
  const initialLocale = toLocale(profile.locale);
  const [name, setName] = useState(initialName);
  const [locale, setLocale] = useState<Locale>(initialLocale);
  const [nameError, setNameError] = useState<string | null>(null);
  const isDirty = name !== initialName || locale !== initialLocale;
  const pending = saving || disabled;

  const shakeInvalid = useErrorShake();
  const [saved, flashSaved] = useTransientFlag(SAVED_FEEDBACK_MS);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const parsed = updateIdentitySchema.safeParse({ name, locale });

    if (!parsed.success) {
      setNameError(t("nameError"));
      shakeInvalid(formElement);
      window.requestAnimationFrame(() =>
        document.getElementById(IDS.name)?.focus(),
      );
      return;
    }

    setNameError(null);
    const outcome = await onSubmit(parsed.data);

    if (!outcome.ok) return;

    flashSaved();

    // The sheet follows the saved preference; the shell crossfades on its own.
    if (parsed.data.locale !== currentLocale) {
      router.replace(pathname, { locale: parsed.data.locale });
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
      <div className="flex flex-col gap-2">
        <Label htmlFor={IDS.name}>{t("nameLabel")}</Label>
        <Input
          id={IDS.name}
          name="name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          autoComplete="name"
          maxLength={80}
          aria-invalid={Boolean(nameError)}
          aria-describedby={nameError ? IDS.nameError : undefined}
          disabled={pending}
        />
        {nameError ? (
          <p id={IDS.nameError} className="text-error-deep text-copy-sm">
            {nameError}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor={IDS.email}>{t("emailLabel")}</Label>
        <Input
          id={IDS.email}
          name="email"
          type="email"
          value={profile.email ?? ""}
          readOnly
          autoComplete="email"
          aria-describedby={IDS.emailNote}
          className="text-muted-foreground"
        />
        <p id={IDS.emailNote} className="text-muted-foreground text-copy-sm">
          {t("emailReadOnly")}
        </p>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor={IDS.locale}>{t("localeLabel")}</Label>
          <Select
            value={locale}
            onValueChange={(value) => setLocale(toLocale(value))}
            disabled={pending}
          >
            <SelectTrigger id={IDS.locale} aria-describedby={IDS.localeHint}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="es">{locales("spanish")}</SelectItem>
              <SelectItem value="en">{locales("english")}</SelectItem>
            </SelectContent>
          </Select>
          <p id={IDS.localeHint} className="text-muted-foreground text-copy-sm">
            {t("localeHint")}
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor={IDS.role}>{t("roleLabel")}</Label>
          <Input
            id={IDS.role}
            name="role"
            value={roles(profile.role)}
            readOnly
            className="text-muted-foreground"
          />
        </div>
      </div>

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
        <ProfileFormStatus
          dirty={isDirty}
          dirtyLabel={t("unsaved")}
          cleanLabel={t("upToDate")}
        />
        <Button
          type="submit"
          disabled={pending || !isDirty}
          className="w-full sm:w-auto"
        >
          <SubmitStatusIcon pending={saving} succeeded={saved} />
          {t("save")}
        </Button>
      </div>
    </form>
  );
}
