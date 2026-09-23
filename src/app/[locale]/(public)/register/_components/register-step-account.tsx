import type { RegisterAccountStep } from "./register.schema";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";

export type AccountErrors = {
  ownerName: string | undefined;
  email: string | undefined;
  password: string | undefined;
};

type RegisterStepAccountProps = {
  values: RegisterAccountStep;
  errors: AccountErrors;
  disabled: boolean;
  ownerNameLabel: string;
  ownerNamePlaceholder: string;
  emailLabel: string;
  emailPlaceholder: string;
  passwordLabel: string;
  passwordPlaceholder: string;
  onChange: (values: RegisterAccountStep) => void;
};

export function RegisterStepAccount({
  values,
  errors,
  disabled,
  ownerNameLabel,
  ownerNamePlaceholder,
  emailLabel,
  emailPlaceholder,
  passwordLabel,
  passwordPlaceholder,
  onChange,
}: RegisterStepAccountProps) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="register-owner-name">{ownerNameLabel}</Label>
        <Input
          id="register-owner-name"
          name="ownerName"
          autoComplete="name"
          value={values.ownerName}
          onChange={(event) =>
            onChange({ ...values, ownerName: event.target.value })
          }
          placeholder={ownerNamePlaceholder}
          aria-invalid={Boolean(errors.ownerName)}
          aria-describedby={
            errors.ownerName ? "register-owner-name-error" : undefined
          }
          disabled={disabled}
        />
        {errors.ownerName ? (
          <p
            id="register-owner-name-error"
            role="alert"
            className="text-error-deep text-copy-sm"
          >
            {errors.ownerName}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="register-email">{emailLabel}</Label>
        <Input
          id="register-email"
          name="email"
          type="email"
          autoComplete="email"
          value={values.email}
          onChange={(event) =>
            onChange({ ...values, email: event.target.value })
          }
          placeholder={emailPlaceholder}
          aria-invalid={Boolean(errors.email)}
          aria-describedby={errors.email ? "register-email-error" : undefined}
          disabled={disabled}
        />
        {errors.email ? (
          <p
            id="register-email-error"
            role="alert"
            className="text-error-deep text-copy-sm"
          >
            {errors.email}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="register-password">{passwordLabel}</Label>
        <Input
          id="register-password"
          name="password"
          type="password"
          autoComplete="new-password"
          value={values.password}
          onChange={(event) =>
            onChange({ ...values, password: event.target.value })
          }
          placeholder={passwordPlaceholder}
          aria-invalid={Boolean(errors.password)}
          aria-describedby={
            errors.password ? "register-password-error" : undefined
          }
          disabled={disabled}
        />
        {errors.password ? (
          <p
            id="register-password-error"
            role="alert"
            className="text-error-deep text-copy-sm"
          >
            {errors.password}
          </p>
        ) : null}
      </div>
    </div>
  );
}
