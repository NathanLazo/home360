"use client";

import { useState, type FormEvent } from "react";
import { LoaderCircleIcon } from "lucide-react";
import { signOut } from "next-auth/react";
import { hasLocale, useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";

import { corporatePasswordFormSchema } from "./corporate-password.schema";
import { useErrorShake } from "~/components/motion";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { getPathname } from "~/i18n/navigation";
import { routing } from "~/i18n/routing";
import { api } from "~/trpc/react";

type FieldKey = "currentPassword" | "newPassword" | "confirmPassword";
type Values = Record<FieldKey, string>;

const EMPTY: Values = {
  currentPassword: "",
  newPassword: "",
  confirmPassword: "",
};

const FIELDS: Array<{ key: FieldKey; autoComplete: string }> = [
  { key: "currentPassword", autoComplete: "current-password" },
  { key: "newPassword", autoComplete: "new-password" },
  { key: "confirmPassword", autoComplete: "new-password" },
];

function isFieldKey(key: PropertyKey): key is FieldKey {
  return (
    key === "currentPassword" ||
    key === "newPassword" ||
    key === "confirmPassword"
  );
}

/**
 * Owner password change through the shared settings service: it checks the
 * current password and revokes every session, so success signs the user out
 * to log in again with the new password.
 */
export function CorporatePasswordForm({
  hasPassword,
}: {
  hasPassword: boolean;
}) {
  const t = useTranslations("corporate.settings.password");
  const errorsT = useTranslations("errors");
  const currentLocale = useLocale();
  const locale = hasLocale(routing.locales, currentLocale)
    ? currentLocale
    : routing.defaultLocale;
  const mutation = api.corporate.changePassword.useMutation();
  const shakeInvalid = useErrorShake();
  const [values, setValues] = useState<Values>(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<FieldKey, string>>>({});

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const parsed = corporatePasswordFormSchema.safeParse(values);

    if (!parsed.success) {
      const next: Partial<Record<FieldKey, string>> = {};

      for (const issue of parsed.error.issues) {
        const key = issue.path[0];

        if (key !== undefined && isFieldKey(key) && next[key] === undefined) {
          next[key] = t(`validation.${key}`);
        }
      }

      setErrors(next);
      shakeInvalid(form);
      const first = parsed.error.issues[0]?.path[0];

      if (first !== undefined && isFieldKey(first)) {
        document.getElementById(`corporate-${first}`)?.focus();
      }

      return;
    }

    setErrors({});

    try {
      const response = await mutation.mutateAsync({
        currentPassword: parsed.data.currentPassword,
        newPassword: parsed.data.newPassword,
      });

      if (response.error === "CURRENT_PASSWORD_INVALID") {
        setErrors({ currentPassword: errorsT("CURRENT_PASSWORD_INVALID") });
        shakeInvalid(form);
        document.getElementById("corporate-currentPassword")?.focus();
        return;
      }

      if (response.error !== null) {
        toast.error(errorsT(response.error));
        return;
      }

      setValues(EMPTY);
      toast.success(t("success"));
      await signOut({ redirectTo: getPathname({ href: "/login", locale }) });
    } catch {
      toast.error(t("error"));
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2 className="text-display-sm">{t("title")}</h2>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {hasPassword ? (
          <form
            onSubmit={handleSubmit}
            noValidate
            className="flex max-w-md flex-col gap-4"
          >
            {FIELDS.map(({ key, autoComplete }) => (
              <div key={key} className="flex flex-col gap-2">
                <Label htmlFor={`corporate-${key}`}>{t(key)}</Label>
                <Input
                  id={`corporate-${key}`}
                  type="password"
                  autoComplete={autoComplete}
                  value={values[key]}
                  disabled={mutation.isPending}
                  className="min-h-11"
                  aria-invalid={Boolean(errors[key])}
                  aria-describedby={
                    errors[key] ? `corporate-${key}-error` : undefined
                  }
                  onChange={(event) => {
                    setValues((current) => ({
                      ...current,
                      [key]: event.target.value,
                    }));
                    setErrors({});
                  }}
                />
                {errors[key] ? (
                  <p
                    id={`corporate-${key}-error`}
                    role="alert"
                    className="text-error-deep text-xs"
                  >
                    {errors[key]}
                  </p>
                ) : null}
              </div>
            ))}
            <p className="text-muted-foreground text-xs">{t("signOutHint")}</p>
            <Button
              type="submit"
              className="min-h-11 self-start"
              disabled={mutation.isPending}
            >
              {mutation.isPending ? (
                <LoaderCircleIcon
                  aria-hidden="true"
                  className="animate-spin motion-reduce:animate-none"
                />
              ) : null}
              {t("submit")}
            </Button>
          </form>
        ) : (
          <p className="text-muted-foreground text-copy-sm">
            {t("noPassword")}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
