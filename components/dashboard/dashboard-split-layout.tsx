"use client";

import * as React from "react";
import { useSidePeek } from "@/components/dashboard/pages/side-peek-context";
import { SidePeekPanel } from "@/components/dashboard/pages/side-peek-panel";
import { cn } from "@/lib/utils";

interface DashboardSplitLayoutProps {
  children: React.ReactNode;
}

export function DashboardSplitLayout({ children }: DashboardSplitLayoutProps) {
  const { isOpen } = useSidePeek();

  return (
    <div className="flex flex-1 overflow-hidden min-w-0 h-full">
      {/* Left Column: Active Page / Main Content */}
      <div
        className={cn(
          "flex flex-col overflow-hidden min-w-0 transition-all duration-200",
          isOpen ? "w-1/2 flex-1" : "w-full flex-1"
        )}
      >
        <main className="flex-1 overflow-y-auto no-scrollbar p-6 md:p-8">
          <div
            className={cn(
              "mx-auto w-full transition-all duration-200",
              isOpen ? "max-w-4xl" : "max-w-7xl"
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
