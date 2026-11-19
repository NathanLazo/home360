"use client";

import { useState, type FormEvent } from "react";
import { LoaderCircleIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { WorkerInvitationField } from "./worker-invitation-field";
import { useErrorShake } from "~/components/motion";
import { Button } from "~/components/ui/button";
import { acceptWorkerInvitationSchema } from "~/schemas/auth/worker-invitation.schema";
import { api } from "~/trpc/react";

type FieldKey = "email" | "name" | "password" | "confirmPassword";
type FieldErrors = Partial<Record<FieldKey, string>>;

const FIELD_IDS: Record<FieldKey, string> = {
  email: "invite-worker-email",
  name: "invite-worker-name",
  password: "invite-worker-password",
  confirmPassword: "invite-worker-confirm-password",
};

function isFieldKey(value: unknown): value is FieldKey {
  return (
    value === "email" ||
    value === "name" ||
    value === "password" ||
    value === "confirmPassword"
  );
}

function focusField(key: FieldKey) {
  requestAnimationFrame(() => document.getElementById(FIELD_IDS[key])?.focus());
}

export type WorkerInvitationFormProps = {
  token: string;
  /** Null for a hand-shared link: the worker enters their own email. */
  email: string | null;
  defaultName: string;
  locale: "es" | "en";
  onAccepted: (email: string) => void;
  onInvalidToken: () => void;
};

export function WorkerInvitationForm({
  token,
  email,
  defaultName,
  locale,
  onAccepted,
  onInvalidToken,
}: WorkerInvitationFormProps) {
  const t = useTranslations("auth.inviteWorker");
  const tErrors = useTranslations("errors");
  const [name, setName] = useState(defaultName);
  const [ownEmail, setOwnEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const accept = api.auth.acceptWorkerInvitation.useMutation();
  const shakeInvalid = useErrorShake();
  const fieldMessages: Record<FieldKey, string> = {
    email: t("validation.email"),
    name: t("validation.name"),
    password: t("validation.passwordLength"),
    confirmPassword: t("validation.passwordMismatch"),
  };

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const parsed = acceptWorkerInvitationSchema.safeParse({
      token,
      name,
      ...(email === null ? { email: ownEmail } : {}),
      password,
      confirmPassword,
      locale,
    });

    if (!parsed.success) {
      const next: FieldErrors = {};

      for (const issue of parsed.error.issues) {
        const key = issue.path[0];

        if (key === "token") {
          onInvalidToken();
          return;
        }

        if (isFieldKey(key)) {
          next[key] = fieldMessages[key];
        }
      }

      setErrors(next);
      shakeInvalid(form);
      const first = parsed.error.issues[0]?.path[0];

      if (isFieldKey(first)) {
        focusField(first);
      }

      return;
    }

    setErrors({});

    try {
      const response = await accept.mutateAsync(parsed.data);

      if (response.error === "INVALID_TOKEN") {
        onInvalidToken();
        return;
      }

      if (response.error === "EMAIL_TAKEN") {
        toast.error(email === null ? t("ownEmailTaken") : t("emailTaken"));
        return;
      }

      if (response.error === "VALIDATION_ERROR") {
        setErrors({ email: fieldMessages.email });
        focusField("email");
        return;
      }

      if (response.error === "TOO_MANY_REQUESTS") {
        toast.error(t("tooManyRequests"));
        return;
      }

      if (response.error !== null || !response.result) {
        toast.error(tErrors("UNKNOWN_ERROR"));
        return;
      }

      setPassword("");
      setConfirmPassword("");
      onAccepted(response.result.email);
    } catch {
      toast.error(tErrors("UNKNOWN_ERROR"));
    }
  }

  const pending = accept.isPending;

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
      {email === null ? (
        <WorkerInvitationField
          id={FIELD_IDS.email}
          label={t("ownEmailLabel")}
          value={ownEmail}
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          error={errors.email}
          disabled={pending}
          onChange={(event) => {
            setOwnEmail(event.target.value);
            setErrors({});
          }}
        />
      ) : (
        <WorkerInvitationField
          id={FIELD_IDS.email}
          label={t("emailLabel")}
          value={email}
          readOnly
          type="email"
          autoComplete="email"
        />
      )}
      <WorkerInvitationField
        id={FIELD_IDS.name}
        label={t("nameLabel")}
        value={name}
        autoComplete="name"
        error={errors.name}
        disabled={pending}
        onChange={(event) => {
          setName(event.target.value);
          setErrors({});
        }}
      />
      <WorkerInvitationField
        id={FIELD_IDS.password}
        label={t("passwordLabel")}
        type="password"
        autoComplete="new-password"
        value={password}
        error={errors.password}
        disabled={pending}
        onChange={(event) => {
          setPassword(event.target.value);
          setErrors({});
        }}
      />
      <WorkerInvitationField
        id={FIELD_IDS.confirmPassword}
        label={t("confirmPasswordLabel")}
        type="password"
        autoComplete="new-password"
        value={confirmPassword}
        error={errors.confirmPassword}
        disabled={pending}
        onChange={(event) => {
          setConfirmPassword(event.target.value);
          setErrors({});
        }}
      />
      <Button
        metal="bend"
        metalClassName="w-full"
        type="submit"
        className="min-h-11 w-full"
        disabled={pending}
      >
        {pending ? (
          <LoaderCircleIcon
            aria-hidden="true"
            className="animate-spin motion-reduce:animate-none"
          />
        ) : null}
        {pending ? t("submitting") : t("submit")}
      </Button>
      {pending ? (
        <span className="sr-only" role="status">
          {t("submitting")}
        </span>
      ) : null}
    </form>
  );
}
