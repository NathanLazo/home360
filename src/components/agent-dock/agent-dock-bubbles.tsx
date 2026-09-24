"use client";

import { AnimatePresence } from "motion/react";

import { AgentDockBubble } from "./agent-dock-bubble";
import { useAgentDock } from "./agent-dock-context";

/**
 * Mounts one bubble per open chat inside the panel (its positioning context)
 * and animates them out when closed. Desktop only, like the footer that
 * owns them; on mobile the full assistant page is the way in.
 */
export function AgentDockBubbles() {
  const { chats } = useAgentDock();

  return (
    <div className="hidden md:contents">
      <AnimatePresence>
        {chats.map((chat) => (
          <AgentDockBubble key={chat.key} chatKey={chat.key} />
        ))}
      </AnimatePresence>
    </div>
  );
}
