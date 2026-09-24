import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";

import { AgentChat } from "~/components/agent/agent-chat";
import { env } from "~/env";
import { routing } from "~/i18n/routing";
import { auth } from "~/server/auth";
import { api, HydrateClient } from "~/trpc/server";

type AssistantPageProps = { params: Promise<{ locale: string }> };

/**
 * Admin assistant (F8). The layout already enforced the role; the page
 * only reads the impersonation flag for the read-only notice and prefetches
 * the thread list. The assistant is unavailable without a gateway key.
 */
export default async function AdminAssistantPage({ params }: AssistantPageProps) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const [session, t] = await Promise.all([
    auth(),
    getTranslations({ locale, namespace: "agent" }),
    api.agent.listConversations.prefetch(),
  ]);

  return (
    <HydrateClient>
      <h1 className="sr-only">{t("pageTitle")}</h1>
      <AgentChat
        area="admin"
        readOnly={session?.user.impersonator != null}
        available={Boolean(env.AI_GATEWAY_API_KEY)}
      />
    </HydrateClient>
  );
}
