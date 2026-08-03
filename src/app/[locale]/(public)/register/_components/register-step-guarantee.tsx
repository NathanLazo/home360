import type { RegisterGuaranteeStep } from "./register.schema";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Textarea } from "~/components/ui/textarea";
import { registerGuaranteeStepSchema } from "~/schemas/auth/register-business.schema";

export type GuaranteeErrors = {
  guaranteeType: string | undefined;
  guaranteeNotes: string | undefined;
};

type RegisterStepGuaranteeProps = {
  values: RegisterGuaranteeStep;
  errors: GuaranteeErrors;
  disabled: boolean;
  guaranteeTypeLabel: string;
  guaranteeTypePlaceholder: string;
  guaranteeNotesLabel: string;
  guaranteeNotesPlaceholder: string;
  depositLabel: string;
  verificationLabel: string;
  insurancePerServiceLabel: string;
  registeredAssetLabel: string;
  combinedLabel: string;
  onChange: (values: RegisterGuaranteeStep) => void;
};

export function RegisterStepGuarantee({
  values,
  errors,
  disabled,
  guaranteeTypeLabel,
  guaranteeTypePlaceholder,
  guaranteeNotesLabel,
  guaranteeNotesPlaceholder,
  depositLabel,
  verificationLabel,
  insurancePerServiceLabel,
  registeredAssetLabel,
  combinedLabel,
  onChange,
}: RegisterStepGuaranteeProps) {
  function handleGuaranteeTypeChange(value: string) {
    const parsed =
      registerGuaranteeStepSchema.shape.guaranteeType.safeParse(value);
    if (parsed.success) {
      onChange({ ...values, guaranteeType: parsed.data });
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="register-guarantee-type">{guaranteeTypeLabel}</Label>
        <Select
          value={values.guaranteeType}
          onValueChange={handleGuaranteeTypeChange}
          disabled={disabled}
          name="guaranteeType"
        >
          <SelectTrigger
            id="register-guarantee-type"
            className="h-11 w-full"
            aria-invalid={Boolean(errors.guaranteeType)}
            aria-describedby={
              errors.guaranteeType ? "register-guarantee-type-error" : undefined
            }
          >
            <SelectValue placeholder={guaranteeTypePlaceholder} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="DEPOSIT">{depositLabel}</SelectItem>
            <SelectItem value="VERIFICATION">{verificationLabel}</SelectItem>
            <SelectItem value="INSURANCE_PER_SERVICE">
              {insurancePerServiceLabel}
            </SelectItem>
            <SelectItem value="REGISTERED_ASSET">
              {registeredAssetLabel}
            </SelectItem>
            <SelectItem value="COMBINED">{combinedLabel}</SelectItem>
          </SelectContent>
        </Select>
        {errors.guaranteeType ? (
          <p
            id="register-guarantee-type-error"
            role="alert"
            className="text-destructive text-sm"
          >
            {errors.guaranteeType}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="register-guarantee-notes">{guaranteeNotesLabel}</Label>
        <Textarea
          id="register-guarantee-notes"
          name="guaranteeNotes"
          value={values.guaranteeNotes ?? ""}
          onChange={(event) =>
            onChange({ ...values, guaranteeNotes: event.target.value })
          }
          placeholder={guaranteeNotesPlaceholder}
          aria-invalid={Boolean(errors.guaranteeNotes)}
          aria-describedby={
            errors.guaranteeNotes ? "register-guarantee-notes-error" : undefined
          }
          disabled={disabled}
          className="min-h-24 resize-y"
        />
        {errors.guaranteeNotes ? (
          <p
            id="register-guarantee-notes-error"
            role="alert"
            className="text-destructive text-sm"
          >
            {errors.guaranteeNotes}
          </p>
        ) : null}
      </div>
    </div>
  );
}
