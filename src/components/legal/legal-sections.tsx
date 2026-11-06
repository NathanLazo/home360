import { cn } from "~/lib/utils";

type LegalSection = {
  key: string;
  title: string;
  body: string;
};

type LegalSectionsProps = {
  sections: readonly LegalSection[];
  /** h3 when the page already has its own h2 above (support FAQ). */
  headingLevel?: "h2" | "h3";
};

/** Titled sections; a blank line in the copy starts a new paragraph. */
export function LegalSections({
  sections,
  headingLevel: Heading = "h2",
}: LegalSectionsProps) {
  return (
    <div className="flex flex-col gap-10">
      {sections.map((section) => (
        <section key={section.key} aria-labelledby={`legal-${section.key}`}>
          <Heading
            id={`legal-${section.key}`}
            className={cn(
              "text-foreground mb-3 text-balance",
              Heading === "h2" ? "text-display-sm" : "text-copy font-semibold",
            )}
          >
            {section.title}
          </Heading>
          <div className="flex flex-col gap-3">
            {section.body.split("\n\n").map((paragraph) => (
              <p
                key={paragraph}
                className="text-copy text-muted-foreground text-pretty"
              >
                {paragraph}
              </p>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
