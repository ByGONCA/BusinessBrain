"use client";

import * as React from "react";
import { AIMessageRecord } from "@/lib/ai/chat/service";
import { SourcesPopover } from "./sources-popover";
import { PhosphorBrain } from "@/components/icons";
import { AlertCircle, StopCircle, User } from "lucide-react";

interface ChatMessageItemProps {
  message: AIMessageRecord | {
    id: string;
    role: "user" | "assistant" | "system" | "tool";
    content: string;
    sources?: any[];
    tokensPrompt?: number;
    tokensCompletion?: number;
    executionDurationMs?: number | null;
    errorCode?: string | null;
  };
  userName?: string;
  userAvatar?: string | null;
}

export function ChatMessageItem({ message, userName = "Você", userAvatar }: ChatMessageItemProps) {
  const isUser = message.role === "user";
  const isAborted = message.errorCode === "ABORTED";
  const isError = Boolean(message.errorCode && message.errorCode !== "ABORTED");

  return (
    <div className={`flex gap-3 text-sm ${isUser ? "flex-row-reverse" : "flex-row"}`}>
      {/* Avatar */}
      <div className="shrink-0 mt-0.5">
        {isUser ? (
          <div className="h-7 w-7 rounded-lg bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center text-xs font-semibold text-zinc-800 dark:text-zinc-200 overflow-hidden">
            {userAvatar ? (
              <img src={userAvatar} alt={userName} className="h-full w-full object-cover" />
            ) : (
              userName.charAt(0).toUpperCase()
            )}
          </div>
        ) : (
          <div className="h-7 w-7 rounded-lg bg-blue-600/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-500/20 flex items-center justify-center">
            <PhosphorBrain className="h-4 w-4" />
          </div>
        )}
      </div>

      {/* Message Body */}
      <div className={`max-w-[85%] sm:max-w-[78%] space-y-1.5 ${isUser ? "text-right" : "text-left"}`}>
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground font-medium">
          <span>{isUser ? userName : "BusinessBrain AI"}</span>
          {isAborted && (
            <span className="inline-flex items-center gap-1 text-[10px] text-amber-500">
              <StopCircle className="h-3 w-3" />
              <span>Interrompido</span>
            </span>
          )}
          {isError && (
            <span className="inline-flex items-center gap-1 text-[10px] text-rose-500">
              <AlertCircle className="h-3 w-3" />
              <span>Falha</span>
            </span>
          )}
        </div>

        <div
          className={`p-3.5 rounded-xl text-left whitespace-pre-wrap leading-relaxed ${
            isUser
              ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 rounded-tr-xs"
              : "border border-border bg-card/60 text-foreground rounded-tl-xs"
          }`}
        >
          {message.content ? (
            <div className="text-sm font-normal selection:bg-blue-500/30">
              {message.content}
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground py-1">
              <span className="h-1.5 w-1.5 rounded-full bg-blue-400 animate-pulse" />
              <span>A pensar e a sintetizar memória...</span>
            </div>
          )}

          {!isUser && message.sources && message.sources.length > 0 && (
            <SourcesPopover sources={message.sources} />
          )}

          {!isUser && ((message.tokensCompletion && message.tokensCompletion > 0) || message.executionDurationMs) && (
            <div className="flex items-center gap-2 pt-2 border-t border-border/40 text-[10px] text-muted-foreground font-mono">
              {Boolean(message.tokensCompletion && message.tokensCompletion > 0) && (
                <span>{(message.tokensPrompt || 0) + (message.tokensCompletion || 0)} tokens</span>
              )}
              {Boolean(message.tokensCompletion && message.tokensCompletion > 0 && message.executionDurationMs) && (
                <span>·</span>
              )}
              {Boolean(message.executionDurationMs) && (
                <span>{((message.executionDurationMs || 0) / 1000).toFixed(2)}s</span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
