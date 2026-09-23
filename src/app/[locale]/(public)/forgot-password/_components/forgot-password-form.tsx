"use client";

import { useState, type FormEvent } from "react";
import { LoaderCircleIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { MetalRing } from "~/components/metal";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { requestPasswordResetSchema } from "~/schemas/auth/password-reset.schema";
import { api } from "~/trpc/react";
import { useErrorShake } from "~/components/motion";

export function ForgotPasswordForm() {
  const t = useTranslations("auth.forgotPassword");
  const locale = useLocale();
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState(false);
  const [transportError, setTransportError] = useState(false);
  const [isConfirmed, setIsConfirmed] = useState(false);
  const requestPasswordReset = api.auth.requestPasswordReset.useMutation();

  const shakeInvalid = useErrorShake();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const parsed = requestPasswordResetSchema.safeParse({ email, locale });
    if (!parsed.success) {
      const hasEmailError = parsed.error.issues.some(
        (issue) => issue.path[0] === "email",
      );
      setEmailError(hasEmailError);
      setTransportError(!hasEmailError);
      shakeInvalid(formElement);
      if (hasEmailError) {
        requestAnimationFrame(() =>
          document.getElementById("forgot-password-email")?.focus(),
        );
      }
      return;
    }

    setEmailError(false);
    setTransportError(false);
    try {
      await requestPasswordReset.mutateAsync(parsed.data);
      setEmail("");
      setIsConfirmed(true);
    } catch {
      setTransportError(true);
    }
  }

  if (isConfirmed) {
    return (
      <p role="status" className="text-foreground text-sm leading-6">
        {t("confirmation")}
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
      <div className="flex flex-col gap-2">
        <Label htmlFor="forgot-password-email">{t("emailLabel")}</Label>
        <Input
          id="forgot-password-email"
          name="email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) => {
            setEmail(event.target.value);
            setEmailError(false);
            setTransportError(false);
          }}
          placeholder={t("emailPlaceholder")}
          aria-invalid={emailError}
          aria-describedby={
            emailError ? "forgot-password-email-error" : undefined
          }
          disabled={requestPasswordReset.isPending}
          className="h-11"
        />
        {emailError ? (
          <p
            id="forgot-password-email-error"
            role="alert"
            className="text-destructive text-sm"
          >
            {t("validation.email")}
          </p>
        ) : null}
      </div>

      {transportError ? (
        <p role="alert" className="text-destructive text-sm">
          {t("transportError")}
        </p>
      ) : null}

      <MetalRing bend className="w-full">
        <Button
          type="submit"
          className="h-11 w-full"
          disabled={requestPasswordReset.isPending}
        >
          {requestPasswordReset.isPending ? (
            <LoaderCircleIcon aria-hidden="true" className="animate-spin" />
          ) : null}
          {requestPasswordReset.isPending ? t("submitting") : t("submit")}
        </Button>
      </MetalRing>
      {requestPasswordReset.isPending ? (
        <span className="sr-only" role="status">
          {t("submitting")}
        </span>
      ) : null}
    </form>
  );
}
