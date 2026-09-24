import { hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";

import { ProfileView } from "~/components/profile/profile-view";
import { env } from "~/env";
import { routing } from "~/i18n/routing";
import { auth } from "~/server/auth";
import { api, HydrateClient } from "~/trpc/server";

type ProfilePageProps = { params: Promise<{ locale: string }> };

/**
 * Admin profile (F9-01). The layout already enforced the role; the page reads
 * the impersonation flag for the read-only notice and prefetches the summary.
 */
export default async function AdminProfilePage({ params }: ProfilePageProps) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const assistantAvailable = Boolean(env.AI_GATEWAY_API_KEY);
  const [session] = await Promise.all([
    auth(),
    api.profile.get.prefetch(),
    assistantAvailable ? api.aiBilling.getSummary.prefetch() : undefined,
  ]);

  return (
    <HydrateClient>
      <ProfileView
        area="admin"
        readOnly={session?.user.impersonator != null}
        assistantAvailable={assistantAvailable}
      />
    </HydrateClient>
  );
}
