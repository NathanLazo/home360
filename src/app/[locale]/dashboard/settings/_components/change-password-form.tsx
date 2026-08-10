"use client";

import { useState, type FormEvent } from "react";
import { LoaderCircleIcon } from "lucide-react";
import { hasLocale, useLocale, useTranslations } from "next-intl";
import { signOut } from "next-auth/react";

import { changePasswordFormSchema } from "./settings.schema";
import type {
  ChangePasswordFormErrors,
  ChangePasswordFormValues,
} from "./settings.types";
import type { MutationOutcome } from "./use-settings-mutations";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { getPathname } from "~/i18n/navigation";
import { routing } from "~/i18n/routing";

const EMPTY_VALUES: ChangePasswordFormValues = {
  currentPassword: "",
  newPassword: "",
  confirmPassword: "",
};

const FIELD_IDS: Record<keyof ChangePasswordFormValues, string> = {
  currentPassword: "settings-current-password",
  newPassword: "settings-new-password",
  confirmPassword: "settings-confirm-password",
};

export function ChangePasswordForm({
  saving,
  onSubmit,
}: {
  saving: boolean;
  onSubmit: (input: {
    currentPassword: string;
    newPassword: string;
  }) => Promise<MutationOutcome>;
}) {
  const t = useTranslations("dashboard.settings.password");
  const currentLocale = useLocale();
  const locale = hasLocale(routing.locales, currentLocale)
    ? currentLocale
    : routing.defaultLocale;
  const [values, setValues] = useState<ChangePasswordFormValues>(EMPTY_VALUES);
  const [errors, setErrors] = useState<ChangePasswordFormErrors>({});
  const [signingOut, setSigningOut] = useState(false);
  const pending = saving || signingOut;

  function focusField(field: keyof ChangePasswordFormValues) {
    window.requestAnimationFrame(() =>
      document.getElementById(FIELD_IDS[field])?.focus(),
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = changePasswordFormSchema.safeParse(values);

    if (!parsed.success) {
      const next: ChangePasswordFormErrors = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path[0];
        if (field === "currentPassword")
          next.currentPassword = t("currentError");
        else if (field === "newPassword")
          next.newPassword =
            issue.code === "custom" ? t("sameAsCurrentError") : t("newError");
        else if (field === "confirmPassword")
          next.confirmPassword = t("confirmError");
      }
      setErrors(next);
      const first = parsed.error.issues[0]?.path[0];
      if (
        first === "currentPassword" ||
        first === "newPassword" ||
        first === "confirmPassword"
      ) {
        focusField(first);
      }
      return;
    }

    setErrors({});
    const outcome = await onSubmit({
      currentPassword: parsed.data.currentPassword,
      newPassword: parsed.data.newPassword,
    });

    if (outcome.code === "CURRENT_PASSWORD_INVALID") {
      // The typed values are dropped: nothing is kept after a failed check.
      setValues(EMPTY_VALUES);
      setErrors({ currentPassword: t("currentInvalid") });
      focusField("currentPassword");
      return;
    }

    if (!outcome.ok) {
      setValues(EMPTY_VALUES);
      return;
    }

    // The server invalidated every session, so the owner signs in again.
    setValues(EMPTY_VALUES);
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
        <h3 className="text-sm font-semibold">{t("title")}</h3>
        <p className="text-muted-foreground text-sm">{t("description")}</p>
      </div>

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
          disabled={pending}
          className="min-h-11 active:scale-[0.98] sm:min-h-10"
        >
          {pending ? (
            <LoaderCircleIcon
              aria-hidden="true"
              className="animate-spin motion-reduce:animate-none"
            />
          ) : null}
          {signingOut ? t("redirecting") : t("save")}
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
        <p id={`${id}-error`} className="text-destructive text-sm">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-muted-foreground text-sm">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
