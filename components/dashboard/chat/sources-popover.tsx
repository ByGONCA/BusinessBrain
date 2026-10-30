"use client";

import * as React from "react";
import { VerifiedSource } from "@/lib/ai/types";
import { ExternalLink, FileText, GitPullRequest, MessageSquare, Brain } from "lucide-react";

interface SourcesPopoverProps {
  sources: VerifiedSource[];
}

export function SourcesPopover({ sources }: SourcesPopoverProps) {
  const [isOpen, setIsOpen] = React.useState(false);

  if (!sources || sources.length === 0) return null;

  return (
    <div className="relative inline-block mt-2">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-lg border border-border bg-card/60 hover:bg-hover text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
      >
        <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
        <span>
          {sources.length} {sources.length === 1 ? "fonte verificada" : "fontes verificadas"}
        </span>
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute left-0 bottom-full mb-2 z-50 w-80 sm:w-96 p-3 rounded-xl border border-border bg-card text-foreground shadow-xl space-y-2.5 max-h-80 overflow-y-auto">
            <div className="flex items-center justify-between pb-1.5 border-b border-border/60">
              <span className="text-xs font-semibold tracking-tight text-foreground">
                Documentos & Fontes Citadas
              </span>
              <span className="text-[10px] font-mono text-muted-foreground">Isolamento RLS</span>
            </div>

            <div className="space-y-2">
              {sources.map((src) => {
                let Icon = FileText;
                if (src.type === "pr") Icon = GitPullRequest;
                if (src.type === "discussion") Icon = MessageSquare;
                if (src.type === "decision") Icon = Brain;

                return (
                  <div
                    key={src.id}
                    className="p-2 rounded-lg border border-border/50 bg-background/50 hover:bg-hover/50 transition-colors space-y-1"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 truncate">
                        <Icon className="h-3.5 w-3.5 text-blue-400 shrink-0" />
                        <span className="text-xs font-medium text-foreground truncate">{src.title}</span>
                      </div>
                      {src.url && (
                        <a
                          href={src.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-muted-foreground hover:text-foreground p-0.5 rounded transition-colors"
                        >
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </div>
                    {src.snippet && (
                      <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-3 font-mono bg-card/60 p-1.5 rounded border border-border/30">
                        {src.snippet}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
