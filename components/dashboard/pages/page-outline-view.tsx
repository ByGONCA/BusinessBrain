"use client";

import * as React from "react";
import { EditorBlock } from "@/lib/pages/types";
import { Heading1, Heading2, Heading3, ArrowRight, ListTree } from "lucide-react";
import { PageIcon } from "./page-icon";
import { cn } from "@/lib/utils";

interface PageOutlineViewProps {
  pageTitle: string;
  pageIcon: string;
  blocks: EditorBlock[];
  onSelectHeading: (blockId: string) => void;
}

export function PageOutlineView({
  pageTitle,
  pageIcon,
  blocks,
  onSelectHeading,
}: PageOutlineViewProps) {
  const headings = React.useMemo(() => {
    return blocks
      .filter((b) => b.type === "heading_1" || b.type === "heading_2" || b.type === "heading_3")
      .map((b) => ({
        id: b.id,
        type: b.type,
        text: (b.content || "").replace(/<[^>]*>?/gm, "").trim() || "Untitled Heading",
      }));
  }, [blocks]);

  return (
    <div className="max-w-3xl mx-auto py-8 px-6 animate-in fade-in duration-150">
      {/* Page Title & Icon Preview */}
      <div className="flex items-center gap-4 pb-6 border-b border-zinc-200 dark:border-zinc-800">
        <PageIcon
          icon={pageIcon}
          className="text-4xl sm:text-5xl select-none"
          imgClassName="h-12 w-12 sm:h-14 sm:w-14 rounded-xl object-cover"
        />
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
            {pageTitle || "Untitled"}
          </h2>
          <div className="flex items-center gap-2 mt-1 text-xs text-zinc-500">
            <ListTree className="h-3.5 w-3.5 text-indigo-500" />
            <span>Document Outline ({headings.length} sections)</span>
          </div>
        </div>
      </div>

      {/* Heading Tree */}
      <div className="mt-8 space-y-2">
        {headings.length === 0 ? (
          <div className="text-center py-12 rounded-xl border border-dashed border-zinc-200 dark:border-zinc-800 p-8">
            <ListTree className="h-8 w-8 text-zinc-400 mx-auto mb-2" />
            <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              No headings in this page yet
            </p>
            <p className="text-xs text-zinc-500 max-w-sm mx-auto mt-1">
              Add Heading 1, 2, or 3 blocks in the Editor to automatically build your dynamic navigation outline.
            </p>
          </div>
        ) : (
          <div className="space-y-1 font-sans">
            {headings.map((h, i) => {
              const isH1 = h.type === "heading_1";
              const isH2 = h.type === "heading_2";
              const isH3 = h.type === "heading_3";

              return (
                <button
                  key={h.id}
                  type="button"
                  onClick={() => onSelectHeading(h.id)}
                  className={cn(
                    "w-full flex items-center justify-between text-left group px-3 py-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800/70 transition-all",
                    isH1 && "text-sm font-semibold text-zinc-900 dark:text-zinc-100",
                    isH2 && "text-xs font-medium text-zinc-700 dark:text-zinc-300 pl-8",
                    isH3 && "text-xs text-zinc-500 dark:text-zinc-400 pl-14"
                  )}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="text-zinc-400 group-hover:text-indigo-500 shrink-0 font-mono text-[10px]">
                      {isH1 ? "H1" : isH2 ? "H2" : "H3"}
                    </span>
                    <span className="truncate group-hover:translate-x-0.5 transition-transform">
                      {h.text}
                    </span>
                  </div>
                  <ArrowRight className="h-3.5 w-3.5 text-zinc-400 opacity-0 group-hover:opacity-100 group-hover:text-indigo-500 transition-all shrink-0" />
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
