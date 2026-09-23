"use client";

import { useState, type FormEvent } from "react";
import { InfoIcon, LoaderCircleIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { GuaranteeReadonlyField } from "./guarantee-readonly-field";
import {
  updateBusinessProfileSchema,
  type UpdateBusinessProfileInput,
} from "./settings.schema";
import type {
  BusinessProfile,
  BusinessProfileFormErrors,
  BusinessProfileFormValues,
  BusinessTypeValue,
} from "./settings.types";
import type { MutationOutcome } from "./use-settings-mutations";
import { useSubscriptionAccess } from "~/components/dashboard/subscription-access-context";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Textarea } from "~/components/ui/textarea";

const BUSINESS_TYPES: BusinessTypeValue[] = ["SERVICES", "PRODUCTS", "MIXED"];

export function BusinessProfileForm({
  profile,
  saving,
  onSubmit,
}: {
  profile: BusinessProfile;
  saving: boolean;
  onSubmit: (input: UpdateBusinessProfileInput) => Promise<MutationOutcome>;
}) {
  const t = useTranslations("dashboard.settings.profile");
  const readOnlyT = useTranslations("dashboard.subscription.readOnly");
  const { isReadOnly } = useSubscriptionAccess();
  const initialValues: BusinessProfileFormValues = {
    businessName: profile.name,
    businessType: profile.type,
    guaranteeNotes: profile.guaranteeNotes ?? "",
  };
  const [values, setValues] =
    useState<BusinessProfileFormValues>(initialValues);
  const [errors, setErrors] = useState<BusinessProfileFormErrors>({});
  const [blocked, setBlocked] = useState(false);
  const isDirty =
    values.businessName !== initialValues.businessName ||
    values.businessType !== initialValues.businessType ||
    values.guaranteeNotes !== initialValues.guaranteeNotes;
  const notice = isReadOnly
    ? readOnlyT("actionDisabled")
    : blocked
      ? t("notActiveNotice")
      : null;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const notes = values.guaranteeNotes.trim();
    const parsed = updateBusinessProfileSchema.safeParse({
      businessName: values.businessName,
      businessType: values.businessType,
      guaranteeNotes: notes === "" ? null : notes,
    });

    if (!parsed.success) {
      const next: BusinessProfileFormErrors = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path[0];
        if (field === "businessName") next.businessName = t("nameError");
        else if (field === "guaranteeNotes")
          next.guaranteeNotes = t("notesError");
        else if (field === "businessType") next.businessType = t("typeError");
      }
      setErrors(next);
      const target = parsed.error.issues[0]?.path[0];
      window.requestAnimationFrame(() =>
        document
          .getElementById(
            target === "guaranteeNotes"
              ? "settings-guarantee-notes"
              : target === "businessType"
                ? "settings-business-type"
                : "settings-business-name",
          )
          ?.focus(),
      );
      return;
    }

    setErrors({});
    const outcome = await onSubmit(parsed.data);
    setBlocked(outcome.code === "BUSINESS_NOT_ACTIVE");
  }

  return (
    <Card>
      <CardHeader>
        <h2 className="leading-none font-semibold">{t("title")}</h2>
        <CardDescription>{t("description")}</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-5"
          noValidate
        >
          {notice ? (
            <p
              id="settings-profile-notice"
              role="status"
              className="text-muted-foreground bg-muted flex items-start gap-2 rounded-lg p-3 text-sm"
            >
              <InfoIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
              {notice}
            </p>
          ) : null}

          <div className="flex flex-col gap-2">
            <Label htmlFor="settings-business-name">{t("nameLabel")}</Label>
            <Input
              id="settings-business-name"
              name="businessName"
              value={values.businessName}
              onChange={(event) =>
                setValues({ ...values, businessName: event.target.value })
              }
              autoComplete="organization"
              aria-invalid={Boolean(errors.businessName)}
              aria-describedby={
                errors.businessName ? "settings-business-name-error" : undefined
              }
              disabled={saving || isReadOnly}
            />
            {errors.businessName ? (
              <p
                id="settings-business-name-error"
                className="text-destructive text-sm"
              >
                {errors.businessName}
              </p>
            ) : null}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="settings-business-type">{t("typeLabel")}</Label>
            <Select
              value={values.businessType}
              onValueChange={(value) =>
                setValues({
                  ...values,
                  businessType:
                    BUSINESS_TYPES.find((type) => type === value) ??
                    values.businessType,
                })
              }
              disabled={saving || isReadOnly}
            >
              <SelectTrigger
                id="settings-business-type"
                className="min-h-11 w-full sm:min-h-10"
                aria-invalid={Boolean(errors.businessType)}
              >
                <SelectValue placeholder={t("typePlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                {BUSINESS_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {t(`businessTypes.${type}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <GuaranteeReadonlyField guaranteeType={profile.guaranteeType} />

          <div className="flex flex-col gap-2">
            <Label htmlFor="settings-guarantee-notes">{t("notesLabel")}</Label>
            <Textarea
              id="settings-guarantee-notes"
              name="guaranteeNotes"
              rows={4}
              maxLength={500}
              value={values.guaranteeNotes}
              onChange={(event) =>
                setValues({ ...values, guaranteeNotes: event.target.value })
              }
              placeholder={t("notesPlaceholder")}
              aria-invalid={Boolean(errors.guaranteeNotes)}
              aria-describedby={
                errors.guaranteeNotes
                  ? "settings-guarantee-notes-error"
                  : "settings-guarantee-notes-hint"
              }
              disabled={saving || isReadOnly}
            />
            {errors.guaranteeNotes ? (
              <p
                id="settings-guarantee-notes-error"
                className="text-destructive text-sm"
              >
                {errors.guaranteeNotes}
              </p>
            ) : (
              <p
                id="settings-guarantee-notes-hint"
                className="text-muted-foreground text-sm"
              >
                {t("notesHint")}
              </p>
            )}
          </div>

          <div className="flex justify-end">
            <Button
              type="submit"
              disabled={saving || !isDirty || isReadOnly}
              className="min-h-11 sm:min-h-10"
            >
              {saving ? (
                <LoaderCircleIcon
                  aria-hidden="true"
                  className="animate-spin motion-reduce:animate-none"
                />
              ) : null}
              {t("save")}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
