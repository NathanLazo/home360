"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import type { AgentArea } from "~/lib/agent/agent-area";

export type AgentDockChat = {
  key: string;
  /** Title derived from the first message; null while the chat is empty. */
  title: string | null;
};

export type AgentDockState = {
  area: AgentArea;
  /** True while an admin impersonates: writes are refused server-side. */
  readOnly: boolean;
  /** False when the gateway key is missing: the composer explains it. */
  available: boolean;
  chats: AgentDockChat[];
  /** Chat shown as a bubble; null = every chat minimized into the bar. */
  activeKey: string | null;
  expanded: boolean;
  openNewChat: () => void;
  focusChat: (key: string) => void;
  minimizeChat: (key: string) => void;
  closeChat: (key: string) => void;
  setChatTitle: (key: string, title: string) => void;
  toggleExpanded: () => void;
};

const AgentDockContext = createContext<AgentDockState | null>(null);

export type AgentDockProviderProps = {
  area: AgentArea;
  readOnly: boolean;
  available: boolean;
  children: ReactNode;
};

/**
 * Client-only state of the quick-access dock: which chats are open in the
 * panel footer and which one floats as a bubble. Chats persist through the
 * `agent` router once they have messages; the dock itself is per tab.
 */
export function AgentDockProvider({
  area,
  readOnly,
  available,
  children,
}: AgentDockProviderProps) {
  const [chats, setChats] = useState<AgentDockChat[]>([]);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  const openNewChat = useCallback(() => {
    setChats((current) => {
      const empty = current.find((chat) => chat.title === null);

      if (empty) {
        setActiveKey(empty.key);
        return current;
      }

      const key = `chat-${Date.now()}`;
      setActiveKey(key);
      return [...current, { key, title: null }];
    });
  }, []);

  const focusChat = useCallback((key: string) => setActiveKey(key), []);

  const minimizeChat = useCallback((key: string) => {
    setActiveKey((current) => (current === key ? null : current));
  }, []);

  const closeChat = useCallback((key: string) => {
    setChats((current) => current.filter((chat) => chat.key !== key));
    setActiveKey((current) => (current === key ? null : current));
  }, []);

  const setChatTitle = useCallback((key: string, title: string) => {
    setChats((current) =>
      current.map((chat) => (chat.key === key ? { ...chat, title } : chat)),
    );
  }, []);

  const toggleExpanded = useCallback(
    () => setExpanded((current) => !current),
    [],
  );

  const value = useMemo<AgentDockState>(
    () => ({
      area,
      readOnly,
      available,
      chats,
      activeKey,
      expanded,
      openNewChat,
      focusChat,
      minimizeChat,
      closeChat,
      setChatTitle,
      toggleExpanded,
    }),
    [
      area,
      readOnly,
      available,
      chats,
      activeKey,
      expanded,
      openNewChat,
      focusChat,
      minimizeChat,
      closeChat,
      setChatTitle,
      toggleExpanded,
    ],
  );

  return (
    <AgentDockContext.Provider value={value}>
      {children}
    </AgentDockContext.Provider>
  );
}

export function useAgentDock(): AgentDockState {
  const context = useContext(AgentDockContext);

  if (!context) {
    throw new Error("useAgentDock must be used inside <AgentDockProvider>");
  }

  return context;
}
