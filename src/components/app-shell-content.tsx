import type { ReactNode } from "react";

import { ToolMotionProvider } from "~/components/motion/tool-motion-provider";

/**
 * Content column shared by the dashboard, admin and corporate shells: one
 * skip-link target, one padding rhythm and one max width, so every tool page
 * lines up the same. `SidebarInset` already renders the `<main>` landmark.
 */
export function AppShellContent({
  id,
  children,
}: {
  id: string;
  children: ReactNode;
}) {
  return (
    <div
      id={id}
      tabIndex={-1}
      className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-4 p-4 outline-none sm:p-6 lg:p-8"
    >
      <ToolMotionProvider>{children}</ToolMotionProvider>
    </div>
  );
}
