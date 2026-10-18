"use client";

import * as React from "react";
import Link from "next/link";
import {
  Inbox,
  Sparkles,
  Check,
  CheckCheck,
  ShieldCheck,
  Lightbulb,
  Bell,
  ArrowRight,
  Search,
  Filter,
  Clock,
  ExternalLink,
} from "lucide-react";
import { ADMIN_MESSAGES } from "@/lib/inbox/data";
import { AdminMessage, AdminMessageBadge } from "@/lib/inbox/types";
import { useInbox } from "./inbox-context";
import { cn } from "@/lib/utils";

const BADGE_CONFIG: Record<
  AdminMessageBadge,
  { label: string; icon: React.ComponentType<{ className?: string }>; colorClass: string }
> = {
  release: {
    label: "Release",
    icon: Sparkles,
    colorClass: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  },
  update: {
    label: "Update",
    icon: Bell,
    colorClass: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
  },
  security: {
    label: "Security",
    icon: ShieldCheck,
    colorClass: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  },
  tip: {
    label: "Tip",
    icon: Lightbulb,
    colorClass: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  },
};

export function InboxPageView() {
  const { unreadCount, readIds, markAsRead, markAllAsRead } = useInbox();
  const [selectedCategory, setSelectedCategory] = React.useState<string>("all");
  const [searchQuery, setSearchQuery] = React.useState<string>("");
  const [activeMessageId, setActiveMessageId] = React.useState<string>(ADMIN_MESSAGES[0]?.id || "");

  const filteredMessages = React.useMemo(() => {
    return ADMIN_MESSAGES.filter((msg) => {
      // Category filter
      if (selectedCategory === "unread" && readIds.includes(msg.id)) return false;
      if (selectedCategory !== "all" && selectedCategory !== "unread" && msg.badge !== selectedCategory) {
        return false;
      }
      // Search filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesTitle = msg.title.toLowerCase().includes(query);
        const matchesSummary = msg.summary.toLowerCase().includes(query);
        const matchesSender = msg.sender.toLowerCase().includes(query);
        return matchesTitle || matchesSummary || matchesSender;
      }
      return true;
    });
  }, [selectedCategory, searchQuery, readIds]);

  const activeMessage = React.useMemo(() => {
    return ADMIN_MESSAGES.find((m) => m.id === activeMessageId) || filteredMessages[0] || null;
  }, [activeMessageId, filteredMessages]);

  const handleSelectMessage = (id: string) => {
    setActiveMessageId(id);
    markAsRead(id);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-6rem)] max-w-7xl mx-auto space-y-4">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-border">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-bold tracking-tight text-foreground">
              Inbox & Updates
            </h1>
            {unreadCount > 0 && (
              <span className="rounded-full bg-blue-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-blue-400 border border-blue-500/20">
                {unreadCount} unread
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            System announcements, product releases, workspace activity, and security advisories.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={markAllAsRead}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-card text-xs font-medium text-secondary-foreground hover:bg-hover hover:text-foreground transition-colors shadow-2xs"
            >
              <CheckCheck className="w-3.5 h-3.5 text-blue-400" />
              <span>Mark all as read</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Split Layout: Left Message List, Right Reader */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 flex-1 overflow-hidden min-h-0">
        {/* Left Column: Filter Controls & List (5 cols) */}
        <div className="md:col-span-5 flex flex-col h-full bg-card rounded-2xl border border-border overflow-hidden">
          {/* Search & Filter Header */}
          <div className="p-3 border-b border-border space-y-2 bg-card">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search updates..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-lg bg-surface-secondary border border-border pl-8 pr-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-border-strong transition-colors"
              />
            </div>

            {/* Category Filter Pills */}
            <div className="flex items-center gap-1 overflow-x-auto no-scrollbar pt-1">
              {[
                { id: "all", label: "All" },
                { id: "unread", label: "Unread" },
                { id: "release", label: "Releases" },
                { id: "security", label: "Security" },
                { id: "update", label: "Updates" },
                { id: "tip", label: "Tips" },
              ].map((cat) => {
                const isActive = selectedCategory === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setSelectedCategory(cat.id)}
                    className={cn(
                      "px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors shrink-0",
                      isActive
                        ? "bg-[#1A1A1E] text-white border border-[#2E2E33]"
                        : "text-muted-foreground hover:text-foreground hover:bg-hover"
                    )}
                  >
                    {cat.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Messages Scrollable List */}
          <div className="flex-1 overflow-y-auto divide-y divide-border-subtle no-scrollbar">
            {filteredMessages.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground space-y-2 h-full">
                <Inbox className="w-8 h-8 text-muted-foreground/60 stroke-[1.5]" />
                <p className="text-xs font-medium text-foreground">No notifications found</p>
                <p className="text-[11px] max-w-xs">
                  {searchQuery ? "Try refining your search keyword." : "You're all caught up with your workspace inbox!"}
                </p>
              </div>
            ) : (
              filteredMessages.map((msg) => {
                const isSelected = activeMessage?.id === msg.id;
                const isUnread = !readIds.includes(msg.id);
                const badgeInfo = BADGE_CONFIG[msg.badge];
                const BadgeIcon = badgeInfo.icon;

                return (
                  <div
                    key={msg.id}
                    onClick={() => handleSelectMessage(msg.id)}
                    className={cn(
                      "p-3.5 cursor-pointer transition-colors relative flex flex-col gap-1.5",
                      isSelected
                        ? "bg-[#1A1A1F] border-l-2 border-l-blue-500"
                        : "hover:bg-hover",
                      isUnread && !isSelected && "bg-blue-500/[0.02]"
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold border",
                          badgeInfo.colorClass
                        )}
                      >
                        <BadgeIcon className="w-2.5 h-2.5" />
                        <span>{badgeInfo.label}</span>
                      </span>

                      <span className="text-[10px] text-muted-foreground font-mono">
                        {new Date(msg.createdAt).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                    </div>

                    <h3
                      className={cn(
                        "text-xs leading-snug line-clamp-1",
                        isUnread ? "font-bold text-foreground" : "font-medium text-secondary-foreground"
                      )}
                    >
                      {msg.title}
                    </h3>

                    <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">
                      {msg.summary}
                    </p>

                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[10px] text-zinc-500 font-medium">
                        {msg.sender}
                      </span>
                      {isUnread && (
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Active Message Detail Reader (7 cols) */}
        <div className="md:col-span-7 flex flex-col h-full bg-card rounded-2xl border border-border overflow-hidden">
          {activeMessage ? (
            <div className="flex flex-col h-full overflow-hidden">
              {/* Message Header */}
              <div className="p-6 border-b border-border bg-surface-secondary/40 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <span
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold border",
                      BADGE_CONFIG[activeMessage.badge].colorClass
                    )}
                  >
                    {React.createElement(BADGE_CONFIG[activeMessage.badge].icon, {
                      className: "w-3 h-3",
                    })}
                    <span>{BADGE_CONFIG[activeMessage.badge].label}</span>
                  </span>

                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-mono">
                    <Clock className="w-3.5 h-3.5" />
                    <span>
                      {new Date(activeMessage.createdAt).toLocaleString(undefined, {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </span>
                  </div>
                </div>

                <h2 className="text-lg font-bold tracking-tight text-foreground leading-snug">
                  {activeMessage.title}
                </h2>

                <div className="flex items-center justify-between pt-1 text-xs">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-blue-600/20 text-blue-400 font-bold flex items-center justify-center text-[10px] border border-blue-500/30">
                      {activeMessage.sender.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <span className="font-medium text-foreground">{activeMessage.sender}</span>
                      <span className="text-muted-foreground text-[11px] ml-1.5">
                        ({activeMessage.senderRole})
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Message Body Content */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4 no-scrollbar text-xs leading-relaxed text-secondary-foreground">
                <div className="p-3.5 rounded-xl bg-surface-secondary/60 border border-border text-foreground font-medium text-xs leading-relaxed">
                  {activeMessage.summary}
                </div>

                <div className="space-y-3 pt-2 text-zinc-300">
                  {activeMessage.content.map((paragraph, idx) => (
                    <p key={idx} className="leading-relaxed">
                      {paragraph}
                    </p>
                  ))}
                </div>

                {activeMessage.actionUrl && (
                  <div className="pt-6 border-t border-border">
                    <Link
                      href={activeMessage.actionUrl}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white shadow-lg transition-colors"
                    >
                      <span>{activeMessage.actionLabel || "View Details"}</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full p-8 text-center text-muted-foreground space-y-2">
              <Inbox className="w-10 h-10 text-muted-foreground/40 stroke-[1.5]" />
              <p className="text-sm font-medium text-foreground">Select a notification</p>
              <p className="text-xs max-w-sm">
                Choose an item from the list on the left to read the full update and take action.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
