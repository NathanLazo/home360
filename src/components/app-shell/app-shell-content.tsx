import type { ReactNode } from "react";

import { ToolMotionProvider } from "~/components/motion/tool-motion-provider";

/**
 * The panel's scroll region, shared by the dashboard, admin and corporate
 * shells: one skip-link target, one padding rhythm and one max width, so
 * every tool page lines up the same. It is the only thing that scrolls: the
 * header and footer around it stay put inside the rounded panel.
 */
export function AppShellContent({
  id,
  children,
}: {
  id: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto overscroll-contain">
      <div
        id={id}
        tabIndex={-1}
        className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-4 p-4 outline-none sm:p-6 lg:p-8"
      >
        <ToolMotionProvider>{children}</ToolMotionProvider>
      </div>
    </div>
  );
}
