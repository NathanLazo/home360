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

async function writeClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

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
  const linkMutation = api.team.invitationLink.useMutation();

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
      const response = await resendMutation.mutateAsync({ id, locale });

      if (response.error === "EMAIL_SEND_FAILED") {
        // Email is down or not configured: hand over the link instead.
        toast.error(t("errors.EMAIL_SEND_FAILED_LINK"), {
          action: {
            label: t("actions.copyInvitationLink"),
            onClick: () => void copyInvitationLink(id),
          },
        });
        return false;
      }

      return await finish(response, t("feedback.invitationResent"), {
        CONFLICT: t("errors.RESEND_CONFLICT"),
      });
    } catch {
      toast.error(t("feedback.transportError"));
      return false;
    }
  }

  async function copyInvitationLink(id: string): Promise<boolean> {
    try {
      const response = await linkMutation.mutateAsync({ id, locale });

      if (response.error !== null || response.result === null) {
        toast.error(
          response.error === "CONFLICT"
            ? t("errors.LINK_CONFLICT")
            : errors(response.error ?? "UNKNOWN_ERROR"),
        );
        return false;
      }

      const { url } = response.result;
      await utils.team.list.invalidate();

      if (await writeClipboard(url)) {
        toast.success(t("feedback.linkCopied"), {
          description: t("feedback.linkSingleUse"),
        });
        return true;
      }

      // Safari drops clipboard access after an await: a click restores it.
      toast(t("feedback.linkReady"), {
        description: url,
        duration: Infinity,
        action: {
          label: t("actions.copy"),
          onClick: () => {
            void writeClipboard(url).then((copied) => {
              if (copied) toast.success(t("feedback.linkCopied"));
            });
          },
        },
      });
      return true;
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
    copyInvitationLink,
    creating: createMutation.isPending,
    updating: updateMutation.isPending,
    deleting: deleteMutation.isPending,
    resending: resendMutation.isPending,
    linking: linkMutation.isPending,
  };
}
