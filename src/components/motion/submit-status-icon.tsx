"use client";

import { LoaderCircleIcon } from "lucide-react";

import { SuccessCheck } from "./success-check";

/**
 * Leading icon for a submit button: a spinner while the mutation runs, then a
 * brief success check once it lands. Nothing at rest.
 */
export function SubmitStatusIcon({
  pending,
  succeeded,
}: {
  pending: boolean;
  succeeded: boolean;
}) {
  if (pending) {
    return (
      <LoaderCircleIcon
        aria-hidden="true"
        className="animate-spin motion-reduce:animate-none"
      />
    );
  }

  return succeeded ? <SuccessCheck /> : null;
}
