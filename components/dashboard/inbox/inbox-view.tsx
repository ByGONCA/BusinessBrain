"use client";

import * as React from "react";
import Link from "next/link";
import {
  Inbox,
  Sparkles,
  CheckCircle2,
  Clock,
  ExternalLink,
  ShieldCheck,
  Megaphone,
  Bell,
  Check,
  X,
  Filter,
  ArrowRight,
} from "lucide-react";
import { ADMIN_MESSAGES } from "@/lib/inbox/data";
import { AdminMessage } from "@/lib/inbox/types";
import { useLanguage } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export function InboxView() {
  const { t } = useLanguage();
  const [selectedCategory, setSelectedCategory] = React.useState<string>("all");
  const [readIds, setReadIds] = React.useState<string[]>([]);
  const [activeMessage, setActiveMessage] = React.useState<AdminMessage | null>(null);

  // Load read status from localStorage
  React.useEffect(() => {
    try {
      const stored = localStorage.getItem("cb_read_inbox_messages");
      if (stored) {
        setReadIds(JSON.parse(stored));
      }
    } catch {}
  }, []);

  const markAsRead = (id: string) => {
    if (!readIds.includes(id)) {
      const next = [...readIds, id];
      setReadIds(next);
      try {
        localStorage.setItem("cb_read_inbox_messages", JSON.stringify(next));
      } catch {}
    }
  };

  const markAllAsRead = () => {
    const allIds = ADMIN_MESSAGES.map((m) => m.id);
    setReadIds(allIds);
    try {
      localStorage.setItem("cb_read_inbox_messages", JSON.stringify(allIds));
    } catch {}
  };

  const handleOpenMessage = (msg: AdminMessage) => {
    setActiveMessage(msg);
    markAsRead(msg.id);
  };

  const unreadCount = ADMIN_MESSAGES.filter((m) => !readIds.includes(m.id)).length;

  const filteredMessages = ADMIN_MESSAGES.filter((m) => {
    if (selectedCategory === "all") return true;
    if (selectedCategory === "unread") return !readIds.includes(m.id);
    return m.badge === selectedCategory;
  });

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
              {t.inboxPage.title}
            </h1>
            {unreadCount > 0 && (
              <span className="rounded-full bg-blue-600 px-2 py-0.5 text-[11px] font-bold text-white shadow-2xs">
                {unreadCount} {t.inboxPage.unread}
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            {t.inboxPage.description}
          </p>
        </div>

        {unreadCount > 0 && (
          <button
            type="button"
            onClick={markAllAsRead}
            className="self-start sm:self-auto inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 py-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors shadow-2xs"
          >
            <Check className="h-3.5 w-3.5 text-zinc-500" />
            <span>{t.inboxPage.markAllRead}</span>
          </button>
        )}
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar border-b border-zinc-200 dark:border-zinc-800 pb-2">
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
              "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors",
              selectedCategory === tab.id
                ? "bg-zinc-200 dark:bg-zinc-800 text-zinc-900 dark:text-white font-semibold"
                : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800/60"
            )}
          >
            <span>{tab.label}</span>
            {tab.count !== undefined && tab.count > 0 && (
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.2 text-[10px] font-mono",
                  selectedCategory === tab.id
                    ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                    : "bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
                )}
              >
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Messages Feed */}
      <div className="space-y-3">
        {filteredMessages.length > 0 ? (
          filteredMessages.map((msg) => {
            const isRead = readIds.includes(msg.id);
            return (
              <div
                key={msg.id}
                onClick={() => handleOpenMessage(msg)}
                className={cn(
                  "group relative cursor-pointer rounded-xl border p-4 transition-all shadow-2xs hover:border-zinc-300 dark:hover:border-zinc-700",
                  isRead
                    ? "border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#161618] opacity-80"
                    : "border-blue-500/40 bg-blue-500/[0.03] dark:bg-blue-500/[0.04] opacity-100 ring-1 ring-blue-500/20"
                )}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 min-w-0">
                    {/* Dev Icon Badge */}
                    <div
                      className={cn(
                        "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border text-xs font-bold shadow-2xs",
                        msg.badge === "release"
                          ? "bg-purple-500/10 border-purple-500/20 text-purple-600 dark:text-purple-400"
                          : msg.badge === "security"
                          ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                          : msg.badge === "update"
                          ? "bg-blue-500/10 border-blue-500/20 text-blue-600 dark:text-blue-400"
                          : "bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400"
                      )}
                    >
                      <Sparkles className="h-4 w-4" />
                    </div>

                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-xs text-zinc-900 dark:text-white">
                          {msg.sender}
                        </span>
                        <span className="rounded bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.2 text-[9px] font-mono text-zinc-500 uppercase">
                          {msg.senderRole}
                        </span>
                        <span className="rounded-full bg-zinc-100 dark:bg-zinc-800 px-2 py-0.2 text-[10px] font-medium capitalize text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700/60">
                          {msg.badge}
                        </span>
                      </div>

                      <h3
                        className={cn(
                          "text-sm tracking-tight",
                          isRead ? "font-medium text-zinc-800 dark:text-zinc-200" : "font-bold text-zinc-900 dark:text-white"
                        )}
                      >
                        {msg.title}
                      </h3>

                      <p className="text-xs text-zinc-500 dark:text-zinc-400 line-clamp-2 leading-relaxed">
                        {msg.summary}
                      </p>
                    </div>
                  </div>

                  {/* Right side: Timestamp & Unread indicator */}
                  <div className="shrink-0 flex flex-col items-end gap-2 text-right">
                    <span className="text-[10px] font-mono text-zinc-400 whitespace-nowrap">
                      {new Date(msg.createdAt).toLocaleDateString([], {
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                    {!isRead && (
                      <span className="h-2 w-2 rounded-full bg-blue-500 ring-2 ring-blue-500/20" />
                    )}
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="rounded-xl border border-dashed border-zinc-300 dark:border-zinc-800 p-10 text-center space-y-3">
            <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-400">
              <Inbox className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                {t.inboxPage.emptyState}
              </p>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1">
                {t.inboxPage.noMessagesFound}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Reader Modal for Selected Message */}
      {activeMessage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4"
          onClick={() => setActiveMessage(null)}
        >
          <div
            className="w-full max-w-lg rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#161618] p-6 shadow-2xl text-zinc-900 dark:text-zinc-100 animate-in fade-in zoom-in-95 space-y-5"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-start justify-between gap-4 pb-4 border-b border-zinc-200 dark:border-zinc-800">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow-md shadow-blue-500/20">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-xs text-zinc-900 dark:text-white">
                      {activeMessage.sender}
                    </span>
                    <span className="rounded bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.2 text-[9px] font-mono text-zinc-500 uppercase">
                      {activeMessage.senderRole}
                    </span>
                  </div>
                  <p className="text-[11px] font-mono text-zinc-400 mt-0.5">
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

              <button
                type="button"
                onClick={() => setActiveMessage(null)}
                className="p-1 rounded-md text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Message Body */}
            <div className="space-y-3">
              <h2 className="text-base font-bold tracking-tight text-zinc-900 dark:text-white">
                {activeMessage.title}
              </h2>

              <div className="space-y-2.5 text-xs text-zinc-700 dark:text-zinc-300 leading-relaxed">
                {activeMessage.content.map((paragraph, index) => (
                  <p key={index}>{paragraph}</p>
                ))}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
              {activeMessage.actionUrl ? (
                <Link
                  href={activeMessage.actionUrl}
                  onClick={() => setActiveMessage(null)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white shadow-2xs hover:bg-blue-500 transition-colors"
                >
                  <span>{activeMessage.actionLabel || "View"}</span>
                  <ArrowRight className="h-3 w-3" />
                </Link>
              ) : (
                <span />
              )}

              <button
                type="button"
                onClick={() => setActiveMessage(null)}
                className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors"
              >
                {t.inboxPage.closeReader}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
