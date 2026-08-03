import type { RegisterBusinessStep } from "./register.schema";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { registerBusinessStepSchema } from "~/schemas/auth/register-business.schema";

export type BusinessErrors = {
  businessName: string | undefined;
  businessType: string | undefined;
};

type RegisterStepBusinessProps = {
  values: RegisterBusinessStep;
  errors: BusinessErrors;
  disabled: boolean;
  businessNameLabel: string;
  businessNamePlaceholder: string;
  businessTypeLabel: string;
  businessTypePlaceholder: string;
  servicesLabel: string;
  productsLabel: string;
  mixedLabel: string;
  onChange: (values: RegisterBusinessStep) => void;
};

export function RegisterStepBusiness({
  values,
  errors,
  disabled,
  businessNameLabel,
  businessNamePlaceholder,
  businessTypeLabel,
  businessTypePlaceholder,
  servicesLabel,
  productsLabel,
  mixedLabel,
  onChange,
}: RegisterStepBusinessProps) {
  function handleBusinessTypeChange(value: string) {
    const parsed =
      registerBusinessStepSchema.shape.businessType.safeParse(value);
    if (parsed.success) {
      onChange({ ...values, businessType: parsed.data });
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="register-business-name">{businessNameLabel}</Label>
        <Input
          id="register-business-name"
          name="businessName"
          autoComplete="organization"
          value={values.businessName}
          onChange={(event) =>
            onChange({ ...values, businessName: event.target.value })
          }
          placeholder={businessNamePlaceholder}
          aria-invalid={Boolean(errors.businessName)}
          aria-describedby={
            errors.businessName ? "register-business-name-error" : undefined
          }
          disabled={disabled}
          className="h-11"
        />
        {errors.businessName ? (
          <p
            id="register-business-name-error"
            role="alert"
            className="text-destructive text-sm"
          >
            {errors.businessName}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="register-business-type">{businessTypeLabel}</Label>
        <Select
          value={values.businessType}
          onValueChange={handleBusinessTypeChange}
          disabled={disabled}
          name="businessType"
        >
          <SelectTrigger
            id="register-business-type"
            className="h-11 w-full"
            aria-invalid={Boolean(errors.businessType)}
            aria-describedby={
              errors.businessType ? "register-business-type-error" : undefined
            }
          >
            <SelectValue placeholder={businessTypePlaceholder} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="SERVICES">{servicesLabel}</SelectItem>
            <SelectItem value="PRODUCTS">{productsLabel}</SelectItem>
            <SelectItem value="MIXED">{mixedLabel}</SelectItem>
          </SelectContent>
        </Select>
        {errors.businessType ? (
          <p
            id="register-business-type-error"
            role="alert"
            className="text-destructive text-sm"
          >
            {errors.businessType}
          </p>
        ) : null}
      </div>
    </div>
  );
}
