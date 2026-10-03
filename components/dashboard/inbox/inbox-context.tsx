"use client";

import * as React from "react";
import { ADMIN_MESSAGES } from "@/lib/inbox/data";

interface InboxContextValue {
  isInboxOpen: boolean;
  openInbox: () => void;
  closeInbox: () => void;
  toggleInbox: () => void;
  unreadCount: number;
  readIds: string[];
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
}

const InboxContext = React.createContext<InboxContextValue | null>(null);

export function InboxProvider({ children }: { children: React.ReactNode }) {
  const [isInboxOpen, setIsInboxOpen] = React.useState(false);
  const [readIds, setReadIds] = React.useState<string[]>([]);

  // Initialize read messages from localStorage
  React.useEffect(() => {
    try {
      const stored = localStorage.getItem("cb_read_inbox_messages");
      if (stored) {
        setReadIds(JSON.parse(stored));
      }
    } catch {}
  }, []);

  const openInbox = React.useCallback(() => setIsInboxOpen(true), []);
  const closeInbox = React.useCallback(() => setIsInboxOpen(false), []);
  const toggleInbox = React.useCallback(() => setIsInboxOpen((prev) => !prev), []);

  const markAsRead = React.useCallback((id: string) => {
    setReadIds((prev) => {
      if (prev.includes(id)) return prev;
      const next = [...prev, id];
      try {
        localStorage.setItem("cb_read_inbox_messages", JSON.stringify(next));
      } catch {}
      return next;
    });
  }, []);

  const markAllAsRead = React.useCallback(() => {
    const allIds = ADMIN_MESSAGES.map((m) => m.id);
    setReadIds(allIds);
    try {
      localStorage.setItem("cb_read_inbox_messages", JSON.stringify(allIds));
    } catch {}
  }, []);

  const unreadCount = ADMIN_MESSAGES.filter((m) => !readIds.includes(m.id)).length;

  return (
    <InboxContext.Provider
      value={{
        isInboxOpen,
        openInbox,
        closeInbox,
        toggleInbox,
        unreadCount,
        readIds,
        markAsRead,
        markAllAsRead,
      }}
    >
      {children}
    </InboxContext.Provider>
  );
}

export function useInbox() {
  const ctx = React.useContext(InboxContext);
  if (!ctx) {
    throw new Error("useInbox must be used within an InboxProvider");
  }
  return ctx;
}
