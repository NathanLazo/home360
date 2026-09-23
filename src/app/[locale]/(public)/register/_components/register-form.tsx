"use client";

import { useState, type FormEvent } from "react";
import { BusinessType, GuaranteeType } from "@generated/prisma";
import { LoaderCircleIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { RegisterProgress } from "./register-progress";
import {
  RegisterStepAccount,
  type AccountErrors,
} from "./register-step-account";
import {
  RegisterStepBusiness,
  type BusinessErrors,
} from "./register-step-business";
import {
  RegisterStepGuarantee,
  type GuaranteeErrors,
} from "./register-step-guarantee";
import {
  registerAccountStepSchema,
  registerBusinessSchema,
  registerBusinessStepSchema,
  registerGuaranteeStepSchema,
  type RegisterAccountStep,
  type RegisterBusinessStep,
  type RegisterGuaranteeStep,
} from "./register.schema";
import { MetalRing } from "~/components/metal";
import { Button } from "~/components/ui/button";
import { useRouter } from "~/i18n/navigation";
import type { AuthErrorCode } from "~/schemas/auth/auth-errors";
import { api } from "~/trpc/react";
import { useErrorShake } from "~/components/motion";

type Step = 0 | 1 | 2;
type ErrorMessageKey =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION_ERROR"
  | "CONFLICT"
  | "PLAN_LIMIT_REACHED"
  | "BUSINESS_NOT_ACTIVE"
  | "INSUFFICIENT_BALANCE"
  | "STRIPE_ERROR"
  | "INTERNAL_ERROR"
  | "UNKNOWN_ERROR"
  | "EMAIL_TAKEN"
  | "TOO_MANY_REQUESTS";

const REGISTRATION_ERROR_KEYS = {
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
  NOT_FOUND: "NOT_FOUND",
  VALIDATION_ERROR: "VALIDATION_ERROR",
  CONFLICT: "CONFLICT",
  PLAN_LIMIT_REACHED: "PLAN_LIMIT_REACHED",
  BUSINESS_NOT_ACTIVE: "BUSINESS_NOT_ACTIVE",
  INSUFFICIENT_BALANCE: "INSUFFICIENT_BALANCE",
  STRIPE_ERROR: "STRIPE_ERROR",
  INTERNAL_ERROR: "INTERNAL_ERROR",
  UNKNOWN_ERROR: "UNKNOWN_ERROR",
  EMAIL_TAKEN: "EMAIL_TAKEN",
  INVALID_TOKEN: "UNKNOWN_ERROR",
  TOO_MANY_REQUESTS: "TOO_MANY_REQUESTS",
} satisfies Record<AuthErrorCode, ErrorMessageKey>;

const INITIAL_ACCOUNT: RegisterAccountStep = {
  ownerName: "",
  email: "",
  password: "",
};
const INITIAL_BUSINESS: RegisterBusinessStep = {
  businessName: "",
  businessType: BusinessType.SERVICES,
};
const INITIAL_GUARANTEE: RegisterGuaranteeStep = {
  guaranteeType: GuaranteeType.DEPOSIT,
  guaranteeNotes: "",
};
const NO_ACCOUNT_ERRORS: AccountErrors = {
  ownerName: undefined,
  email: undefined,
  password: undefined,
};
const NO_BUSINESS_ERRORS: BusinessErrors = {
  businessName: undefined,
  businessType: undefined,
};
const NO_GUARANTEE_ERRORS: GuaranteeErrors = {
  guaranteeType: undefined,
  guaranteeNotes: undefined,
};

function focusField(id: string) {
  requestAnimationFrame(() => document.getElementById(id)?.focus());
}

export function RegisterForm() {
  const t = useTranslations("auth.register");
  const tErrors = useTranslations("errors");
  const router = useRouter();
  const [step, setStep] = useState<Step>(0);
  const [account, setAccount] = useState<RegisterAccountStep>(INITIAL_ACCOUNT);
  const [business, setBusiness] =
    useState<RegisterBusinessStep>(INITIAL_BUSINESS);
  const [guarantee, setGuarantee] =
    useState<RegisterGuaranteeStep>(INITIAL_GUARANTEE);
  const [accountErrors, setAccountErrors] =
    useState<AccountErrors>(NO_ACCOUNT_ERRORS);
  const [businessErrors, setBusinessErrors] =
    useState<BusinessErrors>(NO_BUSINESS_ERRORS);
  const [guaranteeErrors, setGuaranteeErrors] =
    useState<GuaranteeErrors>(NO_GUARANTEE_ERRORS);
  const registerBusiness = api.auth.registerBusiness.useMutation();

  function validateAccount(): boolean {
    const parsed = registerAccountStepSchema.safeParse(account);
    if (parsed.success) {
      setAccount(parsed.data);
      setAccountErrors(NO_ACCOUNT_ERRORS);
      return true;
    }

    const next: AccountErrors = {
      ownerName: undefined,
      email: undefined,
      password: undefined,
    };
    for (const issue of parsed.error.issues) {
      if (issue.path[0] === "ownerName") {
        next.ownerName = t("validation.ownerName");
      }
      if (issue.path[0] === "email") next.email = t("validation.email");
      if (issue.path[0] === "password") {
        next.password = t("validation.password");
      }
    }
    setAccountErrors(next);
    const firstField = parsed.error.issues[0]?.path[0];
    if (firstField === "ownerName") focusField("register-owner-name");
    if (firstField === "email") focusField("register-email");
    if (firstField === "password") focusField("register-password");
    return false;
  }

  function validateBusiness(): boolean {
    const parsed = registerBusinessStepSchema.safeParse(business);
    if (parsed.success) {
      setBusiness(parsed.data);
      setBusinessErrors(NO_BUSINESS_ERRORS);
      return true;
    }

    const next: BusinessErrors = {
      businessName: undefined,
      businessType: undefined,
    };
    for (const issue of parsed.error.issues) {
      if (issue.path[0] === "businessName") {
        next.businessName = t("validation.businessName");
      }
      if (issue.path[0] === "businessType") {
        next.businessType = t("validation.businessType");
      }
    }
    setBusinessErrors(next);
    const firstField = parsed.error.issues[0]?.path[0];
    if (firstField === "businessName") focusField("register-business-name");
    if (firstField === "businessType") focusField("register-business-type");
    return false;
  }

  function validateGuarantee(): boolean {
    const parsed = registerGuaranteeStepSchema.safeParse(guarantee);
    if (parsed.success) {
      setGuarantee(parsed.data);
      setGuaranteeErrors(NO_GUARANTEE_ERRORS);
      return true;
    }

    const next: GuaranteeErrors = {
      guaranteeType: undefined,
      guaranteeNotes: undefined,
    };
    for (const issue of parsed.error.issues) {
      if (issue.path[0] === "guaranteeType") {
        next.guaranteeType = t("validation.guaranteeType");
      }
      if (issue.path[0] === "guaranteeNotes") {
        next.guaranteeNotes = t("validation.guaranteeNotes");
      }
    }
    setGuaranteeErrors(next);
    const firstField = parsed.error.issues[0]?.path[0];
    if (firstField === "guaranteeType") {
      focusField("register-guarantee-type");
    }
    if (firstField === "guaranteeNotes") {
      focusField("register-guarantee-notes");
    }
    return false;
  }

  const shakeInvalid = useErrorShake();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    if (step === 0) {
      if (validateAccount()) setStep(1);
      else shakeInvalid(formElement);
      return;
    }
    if (step === 1) {
      if (validateBusiness()) setStep(2);
      else shakeInvalid(formElement);
      return;
    }
    if (!validateGuarantee()) {
      shakeInvalid(formElement);
      return;
    }

    const parsed = registerBusinessSchema.safeParse({
      ...account,
      ...business,
      ...guarantee,
    });
    if (!parsed.success) {
      toast.error(tErrors("VALIDATION_ERROR"));
      return;
    }

    try {
      const data = await registerBusiness.mutateAsync(parsed.data);
      if (data.error === "EMAIL_TAKEN") {
        const message = tErrors("EMAIL_TAKEN");
        setAccountErrors({ ...NO_ACCOUNT_ERRORS, email: message });
        setStep(0);
        shakeInvalid(formElement);
        focusField("register-email");
        toast.error(message);
        return;
      }
      if (data.error) {
        toast.error(tErrors(REGISTRATION_ERROR_KEYS[data.error]));
        return;
      }
      if (!data.result) {
        toast.error(tErrors("UNKNOWN_ERROR"));
        return;
      }

      toast.success(t("success"));
      router.push("/login");
    } catch {
      toast.error(tErrors("UNKNOWN_ERROR"));
    }
  }

  function handleBack() {
    if (step === 1) setStep(0);
    if (step === 2) setStep(1);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6" noValidate>
      <RegisterProgress
        step={step}
        progressLabel={t("progress", { current: step + 1, total: 3 })}
        accountLabel={t("steps.account")}
        businessLabel={t("steps.business")}
        guaranteeLabel={t("steps.guarantee")}
      />

      {step === 0 ? (
        <RegisterStepAccount
          values={account}
          errors={accountErrors}
          disabled={registerBusiness.isPending}
          ownerNameLabel={t("ownerName.label")}
          ownerNamePlaceholder={t("ownerName.placeholder")}
          emailLabel={t("email.label")}
          emailPlaceholder={t("email.placeholder")}
          passwordLabel={t("password.label")}
          passwordPlaceholder={t("password.placeholder")}
          onChange={(values) => {
            setAccount(values);
            setAccountErrors(NO_ACCOUNT_ERRORS);
          }}
        />
      ) : null}
      {step === 1 ? (
        <RegisterStepBusiness
          values={business}
          errors={businessErrors}
          disabled={registerBusiness.isPending}
          businessNameLabel={t("businessName.label")}
          businessNamePlaceholder={t("businessName.placeholder")}
          businessTypeLabel={t("businessType.label")}
          businessTypePlaceholder={t("businessType.placeholder")}
          servicesLabel={t("businessType.SERVICES")}
          productsLabel={t("businessType.PRODUCTS")}
          mixedLabel={t("businessType.MIXED")}
          onChange={(values) => {
            setBusiness(values);
            setBusinessErrors(NO_BUSINESS_ERRORS);
          }}
        />
      ) : null}
      {step === 2 ? (
        <RegisterStepGuarantee
          values={guarantee}
          errors={guaranteeErrors}
          disabled={registerBusiness.isPending}
          guaranteeTypeLabel={t("guaranteeType.label")}
          guaranteeTypePlaceholder={t("guaranteeType.placeholder")}
          guaranteeNotesLabel={t("guaranteeNotes.label")}
          guaranteeNotesPlaceholder={t("guaranteeNotes.placeholder")}
          depositLabel={t("guaranteeType.DEPOSIT")}
          verificationLabel={t("guaranteeType.VERIFICATION")}
          insurancePerServiceLabel={t("guaranteeType.INSURANCE_PER_SERVICE")}
          registeredAssetLabel={t("guaranteeType.REGISTERED_ASSET")}
          combinedLabel={t("guaranteeType.COMBINED")}
          onChange={(values) => {
            setGuarantee(values);
            setGuaranteeErrors(NO_GUARANTEE_ERRORS);
          }}
        />
      ) : null}

      <div className="flex gap-3">
        {step > 0 ? (
          <Button
            type="button"
            variant="outline"
            className="h-11 flex-1"
            onClick={handleBack}
            disabled={registerBusiness.isPending}
          >
            {t("back")}
          </Button>
        ) : null}
        <MetalRing bend className="flex-1">
          <Button
            type="submit"
            className="h-11 w-full"
            disabled={registerBusiness.isPending}
          >
            {registerBusiness.isPending ? (
              <LoaderCircleIcon aria-hidden="true" className="animate-spin" />
            ) : null}
            {step === 2 ? t("submit") : t("next")}
          </Button>
        </MetalRing>
      </div>
    </form>
  );
}
