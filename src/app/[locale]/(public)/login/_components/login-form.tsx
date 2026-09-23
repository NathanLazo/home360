"use client";

import { useState, type FormEvent } from "react";
import { LoaderCircleIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { getSession, signIn } from "next-auth/react";
import { toast } from "sonner";

import { ActiveSessionDialog } from "./active-session-dialog";
import { loginSchema } from "./login.schema";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Link, useRouter } from "~/i18n/navigation";
import {
  prepareSignIn,
  type SignInSessionIntent,
} from "~/lib/auth/prepare-sign-in";
import { homeForRole, safeCallbackForRole } from "~/lib/auth/role-home";
import { ACTIVE_SESSION_EXISTS_CODE } from "~/lib/auth/session-errors";
import { useErrorShake } from "~/components/motion";

export type LoginFormProps = { callbackUrl?: string };
type FieldErrors = { email: boolean; password: boolean };
const NO_ERRORS: FieldErrors = { email: false, password: false };

export function LoginForm({ callbackUrl }: LoginFormProps) {
  const t = useTranslations("auth.login");
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<FieldErrors>(NO_ERRORS);
  const [formError, setFormError] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [conflictOpen, setConflictOpen] = useState(false);

  const shakeInvalid = useErrorShake();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const parsed = loginSchema.safeParse({ email, password });
    if (!parsed.success) {
      const next = { email: false, password: false };
      for (const issue of parsed.error.issues) {
        if (issue.path[0] === "email") next.email = true;
        if (issue.path[0] === "password") next.password = true;
      }
      setErrors(next);
      shakeInvalid(formElement);
      setFormError(false);
      return;
    }

    setErrors(NO_ERRORS);
    setFormError(false);
    await attemptSignIn("keep");
  }

  async function attemptSignIn(sessionIntent: SignInSessionIntent) {
    const parsed = loginSchema.safeParse({ email, password });
    if (!parsed.success) return;

    setIsSubmitting(true);
    try {
      await prepareSignIn(sessionIntent);
      const response = await signIn("credentials", {
        ...parsed.data,
        sessionIntent,
        redirect: false,
      });
      if (response?.code === ACTIVE_SESSION_EXISTS_CODE) {
        setConflictOpen(true);
        return;
      }
      if (response?.error) throw new Error();
      setConflictOpen(false);
      const role = (await getSession())?.user.role;
      if (!role) throw new Error();
      if (role === "CUSTOMER" || role === "WORKER") {
        toast(t("mobileOnly"));
        router.push("/");
        return;
      }
      router.replace(
        safeCallbackForRole(role, callbackUrl) ?? homeForRole(role),
      );
    } catch {
      setConflictOpen(false);
      setFormError(true);
      toast.error(t("invalidCredentials"));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        <div className="flex flex-col gap-2">
          <Label htmlFor="login-email">{t("emailLabel")}</Label>
          <Input
            id="login-email"
            name="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder={t("emailPlaceholder")}
            aria-invalid={errors.email}
            aria-describedby={errors.email ? "login-email-error" : undefined}
            disabled={isSubmitting}
          />
          {errors.email ? (
            <p id="login-email-error" className="text-error-deep text-copy-sm">
              {t("invalidCredentials")}
            </p>
          ) : null}
        </div>
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-4">
            <Label htmlFor="login-password">{t("passwordLabel")}</Label>
            <Link
              href="/forgot-password"
              className="text-muted-foreground hover:text-foreground text-sm underline-offset-4 hover:underline"
            >
              {t("forgotPassword")}
            </Link>
          </div>
          <Input
            id="login-password"
            name="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            aria-invalid={errors.password}
            aria-describedby={
              errors.password ? "login-password-error" : undefined
            }
            disabled={isSubmitting}
          />
          {errors.password ? (
            <p
              id="login-password-error"
              className="text-error-deep text-copy-sm"
            >
              {t("invalidCredentials")}
            </p>
          ) : null}
        </div>
        {formError ? (
          <p role="alert" className="text-error-deep text-copy-sm">
            {t("invalidCredentials")}
          </p>
        ) : null}
        <Button
          metal="bend"
          metalClassName="w-full"
          type="submit"
          disabled={isSubmitting}
          className="w-full"
        >
          {isSubmitting ? (
            <LoaderCircleIcon
              data-icon="inline-start"
              aria-hidden="true"
              className="animate-spin"
            />
          ) : null}
          {t("submit")}
        </Button>
      </form>
      <ActiveSessionDialog
        open={conflictOpen}
        onOpenChange={setConflictOpen}
        onConfirm={() => void attemptSignIn("replace")}
        loading={isSubmitting}
      />
    </>
  );
}
