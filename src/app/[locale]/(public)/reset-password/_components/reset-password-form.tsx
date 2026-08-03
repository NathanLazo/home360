"use client";

import { useState, type FormEvent } from "react";
import { LoaderCircleIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Link, useRouter } from "~/i18n/navigation";
import { resetPasswordSchema } from "~/schemas/auth/password-reset.schema";
import { api } from "~/trpc/react";

type PasswordErrors = {
  password: string | undefined;
  confirmPassword: string | undefined;
};
const NO_ERRORS: PasswordErrors = {
  password: undefined,
  confirmPassword: undefined,
};
type ResetPasswordFormProps = { token: string | null };

function focusField(id: string) {
  requestAnimationFrame(() => document.getElementById(id)?.focus());
}

export function ResetPasswordForm({ token }: ResetPasswordFormProps) {
  const t = useTranslations("auth.resetPassword");
  const tErrors = useTranslations("errors");
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState<PasswordErrors>(NO_ERRORS);
  const [isInvalidToken, setIsInvalidToken] = useState(token === null);
  const resetPassword = api.auth.resetPassword.useMutation();

  function showInvalidToken() {
    setPassword("");
    setConfirmPassword("");
    setErrors(NO_ERRORS);
    setIsInvalidToken(true);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (token === null) {
      showInvalidToken();
      return;
    }
    const parsed = resetPasswordSchema.safeParse({
      token,
      password,
      confirmPassword,
    });
    if (!parsed.success) {
      const next: PasswordErrors = {
        password: undefined,
        confirmPassword: undefined,
      };
      for (const issue of parsed.error.issues) {
        if (issue.path[0] === "token") {
          showInvalidToken();
          return;
        }
        if (issue.path[0] === "password")
          next.password = t("validation.passwordLength");
        if (issue.path[0] === "confirmPassword")
          next.confirmPassword = t("validation.passwordMismatch");
      }
      setErrors(next);
      const firstField = parsed.error.issues[0]?.path[0];
      if (firstField === "password") focusField("reset-password-password");
      if (firstField === "confirmPassword")
        focusField("reset-password-confirm-password");
      return;
    }

    setErrors(NO_ERRORS);
    try {
      const data = await resetPassword.mutateAsync(parsed.data);
      if (data.error === "INVALID_TOKEN") {
        showInvalidToken();
        return;
      }
      if (data.error === "VALIDATION_ERROR") {
        setErrors({
          password: t("validation.passwordLength"),
          confirmPassword: undefined,
        });
        focusField("reset-password-password");
        return;
      }
      if (data.error || !data.result) {
        toast.error(tErrors("UNKNOWN_ERROR"));
        return;
      }
      setPassword("");
      setConfirmPassword("");
      toast.success(t("success"));
      router.replace("/login");
    } catch {
      toast.error(tErrors("UNKNOWN_ERROR"));
    }
  }

  if (isInvalidToken) {
    return (
      <div className="flex flex-col gap-4">
        <p role="alert" className="text-foreground text-sm leading-6">
          {t("invalidToken")}
        </p>
        <Button asChild className="h-11 w-full">
          <Link href="/forgot-password">{t("requestAgain")}</Link>
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
      <div className="flex flex-col gap-2">
        <Label htmlFor="reset-password-password">{t("passwordLabel")}</Label>
        <Input
          id="reset-password-password"
          name="password"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(event) => {
            setPassword(event.target.value);
            setErrors(NO_ERRORS);
          }}
          aria-invalid={Boolean(errors.password)}
          aria-describedby={
            errors.password ? "reset-password-password-error" : undefined
          }
          disabled={resetPassword.isPending}
          className="h-11"
        />
        {errors.password ? (
          <p
            id="reset-password-password-error"
            role="alert"
            className="text-destructive text-sm"
          >
            {errors.password}
          </p>
        ) : null}
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="reset-password-confirm-password">
          {t("confirmPasswordLabel")}
        </Label>
        <Input
          id="reset-password-confirm-password"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(event) => {
            setConfirmPassword(event.target.value);
            setErrors(NO_ERRORS);
          }}
          aria-invalid={Boolean(errors.confirmPassword)}
          aria-describedby={
            errors.confirmPassword
              ? "reset-password-confirm-password-error"
              : undefined
          }
          disabled={resetPassword.isPending}
          className="h-11"
        />
        {errors.confirmPassword ? (
          <p
            id="reset-password-confirm-password-error"
            role="alert"
            className="text-destructive text-sm"
          >
            {errors.confirmPassword}
          </p>
        ) : null}
      </div>
      <Button
        type="submit"
        className="h-11 w-full"
        disabled={resetPassword.isPending}
      >
        {resetPassword.isPending ? (
          <LoaderCircleIcon aria-hidden="true" className="animate-spin" />
        ) : null}
        {resetPassword.isPending ? t("submitting") : t("submit")}
      </Button>
      {resetPassword.isPending ? (
        <span className="sr-only" role="status">
          {t("submitting")}
        </span>
      ) : null}
    </form>
  );
}
