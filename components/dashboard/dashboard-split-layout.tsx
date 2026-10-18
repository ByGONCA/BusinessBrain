"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import dynamic from "next/dynamic";
import { useSidePeek } from "@/components/dashboard/pages/side-peek-context";
import { cn } from "@/lib/utils";

// Dynamically import SidePeekPanel so the heavy BlockEditor (and its syntax highlighter/modals)
// is decoupled from the main dashboard layout chunk and loaded on-demand only when side-peek opens.
const SidePeekPanel = dynamic(
  () => import("@/components/dashboard/pages/side-peek-panel").then((mod) => mod.SidePeekPanel),
  { ssr: false }
);

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
              : "overflow-y-auto p-4 sm:p-5 md:p-6 lg:p-7"
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
        <aside className="w-1/2 flex-1 flex flex-col overflow-hidden min-w-0 h-full border-l border-[#242427] transition-all duration-200">
          <SidePeekPanel />
        </aside>
      )}
    </div>
  );
}
