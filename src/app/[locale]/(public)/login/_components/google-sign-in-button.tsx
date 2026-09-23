"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { signIn } from "next-auth/react";
import { toast } from "sonner";

import { ActiveSessionDialog } from "./active-session-dialog";
import { Button } from "~/components/ui/button";
import {
  prepareSignIn,
  type SignInSessionIntent,
} from "~/lib/auth/prepare-sign-in";
import { isSafeInternalPath } from "~/lib/auth/role-home";

export type GoogleSignInButtonProps = {
  callbackUrl?: string;
  postLoginPath: string;
  /** The last Google attempt found the account open on another computer. */
  activeSessionConflict?: boolean;
};

function GoogleIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      data-icon="inline-start"
      aria-hidden="true"
    >
      <path d="M21 12.2a9 9 0 1 1-2.6-6.4" />
      <path d="M21 12h-8v4h4.5" />
    </svg>
  );
}

export function GoogleSignInButton({
  callbackUrl,
  postLoginPath,
  activeSessionConflict = false,
}: GoogleSignInButtonProps) {
  const t = useTranslations("auth.login");
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [conflictOpen, setConflictOpen] = useState(activeSessionConflict);

  async function handleSignIn(sessionIntent: SignInSessionIntent) {
    setIsRedirecting(true);
    const target = new URL(postLoginPath, window.location.origin);
    if (isSafeInternalPath(callbackUrl))
      target.searchParams.set("callbackUrl", callbackUrl);
    try {
      await prepareSignIn(sessionIntent);
      await signIn("google", {
        redirectTo: `${target.pathname}${target.search}`,
      });
    } catch {
      setIsRedirecting(false);
      setConflictOpen(false);
      toast.error(t("oauthFailed"));
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        className="w-full"
        disabled={isRedirecting}
        onClick={() => void handleSignIn("keep")}
      >
        <GoogleIcon />
        {t("googleButton")}
      </Button>
      <ActiveSessionDialog
        open={conflictOpen}
        onOpenChange={setConflictOpen}
        onConfirm={() => void handleSignIn("replace")}
        loading={isRedirecting}
      />
    </>
  );
}
