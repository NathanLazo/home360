"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { signIn } from "next-auth/react";

import { Button } from "~/components/ui/button";
import { isSafeInternalPath } from "~/lib/auth/role-home";

export type GoogleSignInButtonProps = {
  callbackUrl?: string;
  postLoginPath: string;
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
}: GoogleSignInButtonProps) {
  const t = useTranslations("auth.login");
  const [isRedirecting, setIsRedirecting] = useState(false);

  function handleSignIn() {
    setIsRedirecting(true);
    const target = new URL(postLoginPath, window.location.origin);
    if (isSafeInternalPath(callbackUrl))
      target.searchParams.set("callbackUrl", callbackUrl);
    void signIn("google", { redirectTo: `${target.pathname}${target.search}` });
  }

  return (
    <Button
      type="button"
      variant="outline"
      className="w-full"
      disabled={isRedirecting}
      onClick={handleSignIn}
    >
      <GoogleIcon />
      {t("googleButton")}
    </Button>
  );
}
