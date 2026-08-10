import type { RouterOutputs } from "~/trpc/react";

type SettingsOutput = RouterOutputs["businessSettings"];

export type BusinessSettings = NonNullable<SettingsOutput["get"]["result"]>;
export type BusinessProfile = BusinessSettings["business"];
export type BusinessTypeValue = BusinessProfile["type"];
export type GuaranteeTypeValue = BusinessProfile["guaranteeType"];

export type BusinessProfileFormValues = {
  businessName: string;
  businessType: BusinessTypeValue;
  guaranteeNotes: string;
};

export type BusinessProfileFormErrors = Partial<
  Record<keyof BusinessProfileFormValues, string>
>;

export type ChangePasswordFormValues = {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
};

export type ChangePasswordFormErrors = Partial<
  Record<keyof ChangePasswordFormValues, string>
>;
