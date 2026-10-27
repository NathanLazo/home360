"use client";

import type { ComponentProps } from "react";

import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { PasswordInput } from "~/components/ui/password-input";

export type WorkerInvitationFieldProps = {
  id: string;
  label: string;
  error?: string;
} & Omit<ComponentProps<typeof Input>, "id" | "aria-invalid">;

/** Labelled input with an announced inline error (reset-password pattern). */
export function WorkerInvitationField({
  id,
  label,
  error,
  type,
  ...inputProps
}: WorkerInvitationFieldProps) {
  const errorId = `${id}-error`;
  const controlProps = {
    id,
    "aria-invalid": Boolean(error),
    "aria-describedby": error ? errorId : undefined,
    ...inputProps,
  };

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      {type === "password" ? (
        <PasswordInput {...controlProps} />
      ) : (
        <Input type={type} {...controlProps} />
      )}
      {error ? (
        <p id={errorId} role="alert" className="text-error-deep text-copy-sm">
          {error}
        </p>
      ) : null}
    </div>
  );
}
