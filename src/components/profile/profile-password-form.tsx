"use client";

import { useState, type FormEvent } from "react";
import { LoaderCircleIcon } from "lucide-react";
import { signOut } from "next-auth/react";
import { hasLocale, useLocale, useTranslations } from "next-intl";

import {
  changePasswordFormSchema,
  createPasswordFormSchema,
  isPasswordFieldKey,
  type PasswordFieldKey,
} from "./profile.form-schema";
import type { MutationOutcome } from "./profile.types";
import type { SetPasswordInput } from "~/schemas/profile/profile.schema";
import { useErrorShake } from "~/components/motion";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { getPathname } from "~/i18n/navigation";
import { routing } from "~/i18n/routing";

type Values = Record<PasswordFieldKey, string>;
type Errors = Partial<Record<PasswordFieldKey, string>>;

const EMPTY: Values = {
  currentPassword: "",
  newPassword: "",
  confirmPassword: "",
};

const FIELD_IDS: Record<PasswordFieldKey, string> = {
  currentPassword: "profile-current-password",
  newPassword: "profile-new-password",
  confirmPassword: "profile-confirm-password",
};

/**
 * Change the password, or create the first one for a Google-only account
 * (`hasPassword=false`: no current password field). Success ends every
 * session, so the form signs the user out to log in again.
 */
export function ProfilePasswordForm({
  hasPassword,
  disabled,
  saving,
  onSubmit,
}: {
  hasPassword: boolean;
  disabled: boolean;
  saving: boolean;
  onSubmit: (input: SetPasswordInput) => Promise<MutationOutcome>;
}) {
  const t = useTranslations("profile.security.password");
  const currentLocale = useLocale();
  const locale = hasLocale(routing.locales, currentLocale)
    ? currentLocale
    : routing.defaultLocale;
  const [values, setValues] = useState<Values>(EMPTY);
  const [errors, setErrors] = useState<Errors>({});
  const [signingOut, setSigningOut] = useState(false);
  const pending = saving || signingOut || disabled;
  const shakeInvalid = useErrorShake();

  function focusField(field: PasswordFieldKey) {
    window.requestAnimationFrame(() =>
      document.getElementById(FIELD_IDS[field])?.focus(),
    );
  }

  function messageFor(field: PasswordFieldKey, code: string): string {
    switch (field) {
      case "currentPassword":
        return t("currentError");
      case "newPassword":
        return code === "custom" ? t("sameAsCurrentError") : t("newError");
      case "confirmPassword":
        return t("confirmError");
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const parsed = hasPassword
      ? changePasswordFormSchema.safeParse(values)
      : createPasswordFormSchema.safeParse({
          newPassword: values.newPassword,
          confirmPassword: values.confirmPassword,
        });

    if (!parsed.success) {
      const next: Errors = {};
      let first: PasswordFieldKey | null = null;

      for (const issue of parsed.error.issues) {
        const field = issue.path[0];
        if (field !== undefined && isPasswordFieldKey(field)) {
          next[field] ??= messageFor(field, issue.code);
          first ??= field;
        }
      }

      setErrors(next);
      shakeInvalid(formElement);
      if (first) focusField(first);
      return;
    }

    setErrors({});
    const outcome = await onSubmit({
      currentPassword: hasPassword ? values.currentPassword : null,
      newPassword: parsed.data.newPassword,
    });

    if (outcome.code === "CURRENT_PASSWORD_INVALID") {
      // Nothing typed survives a failed check.
      setValues(EMPTY);
      setErrors({ currentPassword: t("currentInvalid") });
      shakeInvalid(formElement);
      focusField("currentPassword");
      return;
    }

    setValues(EMPTY);
    if (!outcome.ok) return;

    // Every session was revoked server-side: sign in again with the new one.
    setSigningOut(true);
    try {
      await signOut({ redirectTo: getPathname({ href: "/login", locale }) });
    } catch {
      setSigningOut(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
      <div className="flex flex-col gap-1">
        <h3 className="text-copy font-semibold">
          {hasPassword ? t("changeTitle") : t("createTitle")}
        </h3>
        <p className="text-muted-foreground text-copy-sm">
          {hasPassword ? t("changeDescription") : t("createDescription")}
        </p>
      </div>

      {hasPassword ? (
        <PasswordField
          id={FIELD_IDS.currentPassword}
          name="currentPassword"
          label={t("currentLabel")}
          autoComplete="current-password"
          value={values.currentPassword}
          error={errors.currentPassword}
          disabled={pending}
          onChange={(value) => setValues({ ...values, currentPassword: value })}
        />
      ) : null}

      <PasswordField
        id={FIELD_IDS.newPassword}
        name="newPassword"
        label={t("newLabel")}
        autoComplete="new-password"
        hint={t("newHint")}
        value={values.newPassword}
        error={errors.newPassword}
        disabled={pending}
        onChange={(value) => setValues({ ...values, newPassword: value })}
      />

      <PasswordField
        id={FIELD_IDS.confirmPassword}
        name="confirmPassword"
        label={t("confirmLabel")}
        autoComplete="new-password"
        value={values.confirmPassword}
        error={errors.confirmPassword}
        disabled={pending}
        onChange={(value) => setValues({ ...values, confirmPassword: value })}
      />

      <div className="flex justify-end">
        <Button
          type="submit"
          variant="secondary"
          disabled={pending}
          className="w-full sm:w-auto"
        >
          {saving || signingOut ? (
            <LoaderCircleIcon
              aria-hidden="true"
              className="animate-spin motion-reduce:animate-none"
            />
          ) : null}
          {signingOut
            ? t("redirecting")
            : hasPassword
              ? t("change")
              : t("create")}
        </Button>
      </div>
    </form>
  );
}

function PasswordField({
  id,
  name,
  label,
  autoComplete,
  hint,
  value,
  error,
  disabled,
  onChange,
}: {
  id: string;
  name: string;
  label: string;
  autoComplete: "current-password" | "new-password";
  hint?: string;
  value: string;
  error?: string;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        name={name}
        type="password"
        autoComplete={autoComplete}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={Boolean(error)}
        aria-describedby={describedBy}
        disabled={disabled}
      />
      {error ? (
        <p id={`${id}-error`} className="text-error-deep text-copy-sm">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-muted-foreground text-copy-sm">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
