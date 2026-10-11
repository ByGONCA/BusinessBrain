"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { useSidePeek } from "@/components/dashboard/pages/side-peek-context";
import { SidePeekPanel } from "@/components/dashboard/pages/side-peek-panel";
import { cn } from "@/lib/utils";

interface DashboardSplitLayoutProps {
  children: React.ReactNode;
}

export function DashboardSplitLayout({ children }: DashboardSplitLayoutProps) {
  const { isOpen } = useSidePeek();
  const pathname = usePathname();
  const isFullHeightWorkspace = pathname?.startsWith("/dashboard/github");

  return (
    <div className="flex flex-1 overflow-hidden min-w-0 h-full">
      {/* Left Column: Active Page / Main Content */}
      <div
        className={cn(
          "flex flex-col overflow-hidden min-w-0 transition-all duration-200",
          isOpen ? "w-1/2 flex-1" : "w-full flex-1"
        )}
      >
        <main
          className={cn(
            "flex-1 no-scrollbar min-w-0",
            isFullHeightWorkspace
              ? "h-full flex flex-col overflow-hidden p-0"
              : "overflow-y-auto p-6 md:p-8"
          )}
        >
          <div
            className={cn(
              "w-full transition-all duration-200",
              isFullHeightWorkspace
                ? "h-full flex flex-col flex-1 max-w-none"
                : cn("mx-auto", isOpen ? "max-w-4xl" : "max-w-7xl")
            )}
          >
            {children}
          </div>
        </main>
      </div>

      {/* Right Column: Side Peek Page (Side by Side, perfectly leveled) */}
      {isOpen && (
        <aside className="w-1/2 flex-1 flex flex-col overflow-hidden min-w-0 h-full border-l border-zinc-200 dark:border-zinc-800 transition-all duration-200">
          <SidePeekPanel />
        </aside>
      )}
    </div>
  );
}
