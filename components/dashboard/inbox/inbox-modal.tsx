"use client";

import * as React from "react";
import Link from "next/link";
import {
  Inbox,
  Sparkles,
  Check,
  X,
  ArrowLeft,
  ArrowRight,
  ShieldCheck,
} from "lucide-react";
import { ADMIN_MESSAGES } from "@/lib/inbox/data";
import { AdminMessage } from "@/lib/inbox/types";
import { useLanguage } from "@/lib/i18n";
import { useInbox } from "./inbox-context";
import { cn } from "@/lib/utils";

export function InboxModal() {
  const { t } = useLanguage();
  const { isInboxOpen, closeInbox, unreadCount, readIds, markAsRead, markAllAsRead } = useInbox();
  const [selectedCategory, setSelectedCategory] = React.useState<string>("all");
  const [activeMessage, setActiveMessage] = React.useState<AdminMessage | null>(null);

  // Close on Escape key
  React.useEffect(() => {
    if (!isInboxOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (activeMessage) {
          setActiveMessage(null);
        } else {
          closeInbox();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isInboxOpen, activeMessage, closeInbox]);

  if (!isInboxOpen) return null;

  const filteredMessages = ADMIN_MESSAGES.filter((m) => {
    if (selectedCategory === "all") return true;
    if (selectedCategory === "unread") return !readIds.includes(m.id);
    return m.badge === selectedCategory;
  });

  const handleOpenMessage = (msg: AdminMessage) => {
    markAsRead(msg.id);
    setActiveMessage(msg);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-3 sm:p-6 animate-in fade-in duration-150"
      onClick={() => {
        setActiveMessage(null);
        closeInbox();
      }}
    >
      <div
        className="relative flex flex-col h-[620px] max-h-[90vh] w-full max-w-2xl overflow-hidden rounded-2xl border border-[#242427] bg-[#141415] text-[#F5F5F5] shadow-2xl transition-colors duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {activeMessage ? (
          /* ========================================================= */
          /* MESSAGE DETAIL VIEW                                      */
          /* ========================================================= */
          <div className="flex flex-col h-full animate-in fade-in slide-in-from-right-4 duration-150">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#1C1C1F] bg-[#19191B]/40">
              <button
                type="button"
                onClick={() => setActiveMessage(null)}
                className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium text-[#A1A1AA] hover:text-[#F5F5F5] hover:bg-[#1C1C1F] transition-colors"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                <span>{t.common.cancel || "Voltar"}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveMessage(null);
                  closeInbox();
                }}
                className="p-1.5 rounded-lg text-[#71717A] hover:text-[#F5F5F5] hover:bg-[#1C1C1F] transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-5 no-scrollbar">
              <div className="flex items-start gap-3">
                <div
                  className={cn(
                    "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border text-xs font-bold shadow-2xs",
                    activeMessage.badge === "release"
                      ? "bg-purple-500/10 border-purple-500/20 text-purple-600 dark:text-purple-400"
                      : activeMessage.badge === "security"
                      ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                      : activeMessage.badge === "update"
                      ? "bg-blue-500/10 border-blue-500/20 text-blue-600 dark:text-blue-400"
                      : "bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400"
                  )}
                >
                  <Sparkles className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-xs text-zinc-900 dark:text-white">
                      {activeMessage.sender}
                    </span>
                    <span className="rounded bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.2 text-[9px] font-mono text-zinc-500 uppercase">
                      {activeMessage.senderRole}
                    </span>
                    <span className="rounded-full bg-zinc-100 dark:bg-zinc-800 px-2 py-0.2 text-[10px] font-medium capitalize text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700/60">
                      {activeMessage.badge}
                    </span>
                  </div>
                  <p className="text-[11px] font-mono text-zinc-400 mt-1">
                    {new Date(activeMessage.createdAt).toLocaleString([], {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
              </div>

              <div>
                <h2 className="text-base font-bold tracking-tight text-zinc-900 dark:text-white">
                  {activeMessage.title}
                </h2>
              </div>

              <div className="space-y-3 text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed border-t border-zinc-100 dark:border-zinc-800/80 pt-4">
                {activeMessage.content.map((paragraph, index) => (
                  <p key={index}>{paragraph}</p>
                ))}
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-3 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50/40 dark:bg-zinc-900/20 flex items-center justify-between">
              {activeMessage.actionUrl ? (
                <Link
                  href={activeMessage.actionUrl}
                  onClick={() => {
                    setActiveMessage(null);
                    closeInbox();
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-2xs hover:bg-blue-500 transition-colors"
                >
                  <span>{activeMessage.actionLabel || "Abrir"}</span>
                  <ArrowRight className="h-3 w-3" />
                </Link>
              ) : (
                <span />
              )}

              <button
                type="button"
                onClick={() => setActiveMessage(null)}
                className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors"
              >
                {t.inboxPage.closeReader || "Voltar à lista"}
              </button>
            </div>
          </div>
        ) : (
          /* ========================================================= */
          /* MESSAGE FEED / LIST VIEW                                  */
          /* ========================================================= */
          <div className="flex flex-col h-full">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#1C1C1F]">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10 text-blue-400">
                  <Inbox className="h-4 w-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm font-bold tracking-tight text-[#F5F5F5]">
                      Inbox
                    </h2>
                    {unreadCount > 0 && (
                      <span className="rounded-full bg-blue-600 px-1.5 py-0.2 text-[10px] font-bold text-white shadow-2xs">
                        {unreadCount} {t.inboxPage.unread}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-[#71717A]">
                    {t.inboxPage.title}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={markAllAsRead}
                    className="inline-flex items-center gap-1 rounded-lg border border-[#242427] bg-[#19191B] px-2.5 py-1 text-[11px] font-medium text-[#F5F5F5] hover:bg-[#1C1C1F] transition-colors shadow-2xs"
                  >
                    <Check className="h-3 w-3 text-[#71717A]" />
                    <span>{t.inboxPage.markAllRead}</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={closeInbox}
                  className="p-1.5 rounded-lg text-[#71717A] hover:text-[#F5F5F5] hover:bg-[#1C1C1F] transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center gap-1 overflow-x-auto no-scrollbar px-4 py-2 border-b border-[#1C1C1F] bg-[#141415]">
              {[
                { id: "all", label: t.inboxPage.allMessages, count: ADMIN_MESSAGES.length },
                { id: "unread", label: t.inboxPage.unread, count: unreadCount },
                { id: "release", label: t.inboxPage.announcements },
                { id: "update", label: t.inboxPage.updates },
                { id: "security", label: t.inboxPage.security },
                { id: "tip", label: t.inboxPage.tips },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setSelectedCategory(tab.id)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium whitespace-nowrap transition-colors",
                    selectedCategory === tab.id
                      ? "bg-[#242427] text-[#F5F5F5] font-semibold"
                      : "text-[#71717A] hover:text-[#F5F5F5] hover:bg-[#1C1C1F]"
                  )}
                >
                  <span>{tab.label}</span>
                  {tab.count !== undefined && tab.count > 0 && (
                    <span
                      className={cn(
                        "rounded-full px-1.5 py-0.2 text-[10px] font-mono",
                        selectedCategory === tab.id
                          ? "bg-[#F5F5F5] text-[#080809]"
                          : "bg-[#19191B] text-[#A1A1AA]"
                      )}
                    >
                      {tab.count}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Messages Feed */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2.5 no-scrollbar">
              {filteredMessages.length > 0 ? (
                filteredMessages.map((msg) => {
                  const isRead = readIds.includes(msg.id);
                  return (
                    <div
                      key={msg.id}
                      onClick={() => handleOpenMessage(msg)}
                      className={cn(
                        "group relative cursor-pointer rounded-xl border p-3.5 transition-all shadow-2xs hover:border-[#3F3F46]",
                        isRead
                          ? "border-[#242427] bg-[#141415] opacity-85"
                          : "border-blue-500/40 bg-blue-500/[0.04] opacity-100 ring-1 ring-blue-500/20"
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3 min-w-0">
                          <div
                            className={cn(
                              "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border text-xs font-bold shadow-2xs",
                              msg.badge === "release"
                                ? "bg-purple-500/10 border-purple-500/20 text-purple-400"
                                : msg.badge === "security"
                                ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                                : msg.badge === "update"
                                ? "bg-blue-500/10 border-blue-500/20 text-blue-400"
                                : "bg-amber-500/10 border-amber-500/20 text-amber-400"
                            )}
                          >
                            <Sparkles className="h-3.5 w-3.5" />
                          </div>

                          <div className="min-w-0 space-y-0.5">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold text-xs text-[#F5F5F5]">
                                {msg.sender}
                              </span>
                              <span className="rounded bg-[#19191B] px-1 py-0.2 text-[9px] font-mono text-[#71717A] uppercase border border-[#242427]">
                                {msg.senderRole}
                              </span>
                            </div>

                            <h3
                              className={cn(
                                "text-xs tracking-tight",
                                isRead
                                  ? "font-medium text-[#A1A1AA]"
                                  : "font-bold text-[#F5F5F5]"
                              )}
                            >
                              {msg.title}
                            </h3>

                            <p className="text-[11px] text-[#71717A] line-clamp-1">
                              {msg.summary}
                            </p>
                          </div>
                        </div>

                        <div className="shrink-0 flex flex-col items-end gap-1.5 text-right">
                          <span className="text-[10px] font-mono text-[#71717A] whitespace-nowrap">
                            {new Date(msg.createdAt).toLocaleDateString([], {
                              month: "short",
                              day: "numeric",
                            })}
                          </span>
                          {!isRead && (
                            <span className="h-1.5 w-1.5 rounded-full bg-blue-500 ring-2 ring-blue-500/20" />
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="rounded-xl border border-dashed border-[#242427] bg-[#141415]/40 p-8 text-center space-y-2">
                  <div className="mx-auto flex h-9 w-9 items-center justify-center rounded-full bg-[#19191B] text-[#71717A]">
                    <Inbox className="h-4 w-4" />
                  </div>
                  <p className="text-xs font-semibold text-[#F5F5F5]">
                    {t.inboxPage.emptyState}
                  </p>
                  <p className="text-[11px] text-[#71717A]">
                    {t.inboxPage.noMessagesFound}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
