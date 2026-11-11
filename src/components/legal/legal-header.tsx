type LegalHeaderProps = {
  title: string;
  updated: string;
  intro: string;
};

/** Page heading block: the single h1, update date (mono, verifiable data) and intro. */
export function LegalHeader({ title, updated, intro }: LegalHeaderProps) {
  return (
    <div className="mb-12 flex flex-col gap-4 border-b pb-10">
      <h1 className="text-display-md text-foreground text-balance">{title}</h1>
      <p className="text-copy-sm text-muted-foreground font-mono">{updated}</p>
      <p className="text-copy text-foreground text-pretty">{intro}</p>
    </div>
  );
}
