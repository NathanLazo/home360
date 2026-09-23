import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";

import { WorkerInvitationCard } from "./_components/worker-invitation-card";
import { routing } from "~/i18n/routing";
import { api } from "~/trpc/server";

type WorkerInvitePageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ token?: string }>;
};

/**
 * Public worker invitation acceptance (workstream D). Corporate personality
 * like login/reset-password: no mesh, beams or scroll entrances even though
 * it lives under `(public)`.
 */
export default async function WorkerInvitePage({
  params,
  searchParams,
}: WorkerInvitePageProps) {
  const [{ locale }, { token }] = await Promise.all([params, searchParams]);

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "auth.inviteWorker" });
  const preview =
    typeof token === "string" && token.length > 0
      ? await api.auth.getWorkerInvitation({ token }).catch(() => null)
      : null;
  const invitation = preview?.error === null ? preview.result : null;

  return (
    <main className="bg-canvas flex min-h-dvh items-center justify-center px-4 py-12">
      <WorkerInvitationCard
        logoMark={t("logoMark")}
        token={invitation && token ? token : null}
        invitation={invitation}
        locale={locale}
      />
    </main>
  );
}
