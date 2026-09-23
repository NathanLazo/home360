"use client";

import { SubmitStatusIcon } from "~/components/motion";

/**
 * Inner content of a confirm button across its lifecycle: label, spinner
 * while the request flies, then a drawn check and the past-tense label while
 * the dialog holds before closing.
 */
export function ConfirmButtonContent({
  loading,
  succeeded,
  label,
  successLabel,
}: {
  loading: boolean;
  succeeded: boolean;
  label: string;
  successLabel: string;
}) {
  return (
    <>
      <SubmitStatusIcon pending={loading && !succeeded} succeeded={succeeded} />
      {succeeded ? successLabel : label}
    </>
  );
}
