"use client";

import * as React from "react";

interface SidePeekContextValue {
  sidePeekPageId: string | null;
  isOpen: boolean;
  openSidePeek: (pageId: string) => void;
  closeSidePeek: () => void;
}

const SidePeekContext = React.createContext<SidePeekContextValue | null>(null);

export function SidePeekProvider({ children }: { children: React.ReactNode }) {
  const [sidePeekPageId, setSidePeekPageId] = React.useState<string | null>(null);

  const openSidePeek = React.useCallback((pageId: string) => {
    setSidePeekPageId(pageId);
  }, []);

  const closeSidePeek = React.useCallback(() => {
    setSidePeekPageId(null);
  }, []);

  // Close on Escape key if side peek is open
  React.useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && sidePeekPageId) {
        closeSidePeek();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [sidePeekPageId, closeSidePeek]);

  return (
    <SidePeekContext.Provider
      value={{
        sidePeekPageId,
        isOpen: Boolean(sidePeekPageId),
        openSidePeek,
        closeSidePeek,
      }}
    >
      {children}
    </SidePeekContext.Provider>
  );
}

export function useSidePeek() {
  const context = React.useContext(SidePeekContext);
  if (!context) {
    throw new Error("useSidePeek must be used within a SidePeekProvider");
  }
  return context;
}
