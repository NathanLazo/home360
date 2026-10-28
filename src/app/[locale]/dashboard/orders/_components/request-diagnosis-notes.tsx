import { useTranslations } from "next-intl";

/**
 * Notes the customer added to the AI diagnosis (§4). Rendered under the
 * diagnosis so the business reads both together; nothing when empty.
 */
export function RequestDiagnosisNotes({ notes }: { notes: string | null }) {
  const t = useTranslations("dashboard.requests.detail");

  if (!notes) return null;

  return (
    <div className="bg-canvas-soft mt-4 rounded-xl border p-4">
      <h4 className="text-copy-sm mb-1 font-medium">
        {t("diagnosisNotesTitle")}
      </h4>
      <p className="text-muted-foreground text-copy-sm leading-relaxed whitespace-pre-wrap">
        {notes}
      </p>
    </div>
  );
}
