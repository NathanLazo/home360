"use client";

import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";

import type {
  WorkerCreateFormInput,
  WorkerUpdateFormInput,
} from "./team.schema";
import type { EmailLocale } from "~/schemas/team/worker.schema";
import { api } from "~/trpc/react";

type OperationResponse = {
  result: object | null;
  error: string | null;
};

/** Codes that read better with module copy than with the generic `errors.json`. */
type ErrorOverrides = Partial<Record<string, string>>;

export function useTeamMutations() {
  const t = useTranslations("dashboard.team");
  const errors = useTranslations("errors");
  const currentLocale = useLocale();
  // The invitation email is rendered in the language the owner is working in.
  const locale: EmailLocale = currentLocale === "en" ? "en" : "es";
  const utils = api.useUtils();
  const createMutation = api.team.create.useMutation();
  const updateMutation = api.team.update.useMutation();
  const deleteMutation = api.team.delete.useMutation();
  const resendMutation = api.team.resendInvitation.useMutation();

  async function finish(
    response: OperationResponse,
    successMessage: string,
    overrides: ErrorOverrides = {},
  ): Promise<boolean> {
    if (response.error !== null || response.result === null) {
      const code = response.error;
      toast.error(
        code === null
          ? t("feedback.transportError")
          : (overrides[code] ?? errors(code)),
      );
      return false;
    }

    toast.success(successMessage);
    await Promise.all([
      utils.team.list.invalidate(),
      // The services screen shows each service's assigned workers.
      utils.service.list.invalidate(),
      utils.service.listWorkers.invalidate(),
    ]);
    return true;
  }

  async function create(input: WorkerCreateFormInput): Promise<boolean> {
    try {
      return await finish(
        await createMutation.mutateAsync({ ...input, locale }),
        input.invitedEmail
          ? t("feedback.invitationSent")
          : t("feedback.created"),
        {
          PLAN_LIMIT_REACHED: t("errors.PLAN_LIMIT_REACHED"),
          BUSINESS_NOT_ACTIVE: t("errors.BUSINESS_NOT_ACTIVE"),
          EMAIL_SEND_FAILED: t("errors.EMAIL_SEND_FAILED"),
        },
      );
    } catch {
      toast.error(t("feedback.transportError"));
      return false;
    }
  }

  async function update(input: WorkerUpdateFormInput): Promise<boolean> {
    try {
      return await finish(
        await updateMutation.mutateAsync(input),
        t("feedback.updated"),
      );
    } catch {
      toast.error(t("feedback.transportError"));
      return false;
    }
  }

  async function remove(id: string): Promise<boolean> {
    try {
      return await finish(
        await deleteMutation.mutateAsync({ id }),
        t("feedback.deleted"),
        { CONFLICT: t("errors.CONFLICT") },
      );
    } catch {
      toast.error(t("feedback.transportError"));
      return false;
    }
  }

  async function resendInvitation(id: string): Promise<boolean> {
    try {
      return await finish(
        await resendMutation.mutateAsync({ id, locale }),
        t("feedback.invitationResent"),
        {
          CONFLICT: t("errors.RESEND_CONFLICT"),
          EMAIL_SEND_FAILED: t("errors.EMAIL_SEND_FAILED"),
        },
      );
    } catch {
      toast.error(t("feedback.transportError"));
      return false;
    }
  }

  return {
    create,
    update,
    remove,
    resendInvitation,
    creating: createMutation.isPending,
    updating: updateMutation.isPending,
    deleting: deleteMutation.isPending,
    resending: resendMutation.isPending,
  };
}
