"use client";

import * as React from "react";
import Link from "next/link";
import {
  HelpCircle,
  BookOpen,
  MessageSquare,
  MoreHorizontal,
  ChevronRight,
  Keyboard,
  FileText,
  Activity,
  RotateCcw,
  Sparkles,
  ExternalLink,
  X,
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { usePlatform } from "@/lib/hooks/use-platform";
import { useLanguage } from "@/lib/i18n";

export interface HelpMenuProps {
  placement?: "bottom" | "top";
  triggerVariant?: "default" | "quick-nav" | "account-item";
  label?: string;
}

export function HelpMenu({
  placement = "bottom",
  triggerVariant = "default",
  label,
}: HelpMenuProps = {}) {
  const { formatShortcut, modKeyName } = usePlatform();
  const { t } = useLanguage();
  const [isOpen, setIsOpen] = React.useState(false);
  const [isMoreOpen, setIsMoreOpen] = React.useState(false);
  const [showShortcutsModal, setShowShortcutsModal] = React.useState(false);
  const [cacheCleared, setCacheCleared] = React.useState(false);
  const menuRef = React.useRef<HTMLDivElement>(null);

  // Close on outside click
  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setIsMoreOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Close on Escape key
  React.useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        if (showShortcutsModal) {
          setShowShortcutsModal(false);
        } else {
          setIsOpen(false);
          setIsMoreOpen(false);
        }
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showShortcutsModal]);

  const handleClearCache = () => {
    if (typeof window !== "undefined") {
      try {
        sessionStorage.clear();
        setCacheCleared(true);
        setTimeout(() => {
          setCacheCleared(false);
          window.location.reload();
        }, 600);
      } catch {
        window.location.reload();
      }
    }
  };

  return (
    <div className={cn("relative", triggerVariant === "account-item" && "w-full")} ref={menuRef}>
      {/* Trigger Button based on triggerVariant */}
      {triggerVariant === "account-item" ? (
        <button
          type="button"
          onClick={() => {
            setIsOpen(!isOpen);
            setIsMoreOpen(false);
          }}
          aria-expanded={isOpen}
          aria-label={label || t.help.documentation}
          title={label || t.help.documentation}
          className={cn(
            "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-xs text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800/60 hover:text-zinc-900 dark:hover:text-white transition-colors text-left",
            isOpen && "bg-zinc-100 dark:bg-zinc-800/60 text-zinc-900 dark:text-white"
          )}
        >
          <HelpCircle className="h-4 w-4 text-zinc-400 dark:text-zinc-500" />
          <span>{label || t.help.documentation}</span>
        </button>
      ) : triggerVariant === "quick-nav" ? (
        <button
          type="button"
          onClick={() => {
            setIsOpen(!isOpen);
            setIsMoreOpen(false);
          }}
          aria-expanded={isOpen}
          aria-label={label || t.help.documentation}
          title={label || t.help.documentation}
          className={cn(
            "relative flex items-center transition-all duration-150 focus:outline-none rounded-lg p-2 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800/60",
            isOpen && "bg-zinc-200 dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-2xs"
          )}
        >
          <HelpCircle className="h-4 w-4 shrink-0" />
        </button>
      ) : (
        <button
          type="button"
          onClick={() => {
            setIsOpen(!isOpen);
            setIsMoreOpen(false);
          }}
          aria-expanded={isOpen}
          aria-label={t.help.documentation}
          title={t.help.documentation}
          className={cn(
            "flex h-7 w-7 items-center justify-center rounded-lg border border-transparent text-slate-400 hover:border-slate-800 hover:bg-slate-900/80 hover:text-slate-200 transition-colors focus:outline-none",
            isOpen && "bg-slate-900 border-slate-800 text-white"
          )}
        >
          <HelpCircle className="h-4 w-4" />
        </button>
      )}

      {/* Main Help Popover */}
      {isOpen && (
        <div
          className={cn(
            "absolute w-64 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#161618] p-1.5 shadow-2xl backdrop-blur-2xl text-zinc-800 dark:text-zinc-200 z-50 animate-in fade-in zoom-in-95",
            triggerVariant === "account-item"
              ? "left-full bottom-0 ml-1.5"
              : placement === "top"
              ? "top-full left-0 mt-2"
              : "bottom-full left-0 mb-2"
          )}
          style={{
            transformOrigin:
              triggerVariant === "account-item"
                ? "bottom left"
                : placement === "top"
                ? "top left"
                : "bottom left",
          }}
        >
          {/* Top Actions Group */}
          <div className="space-y-0.5">
            <Link
              href="/dashboard/knowledge"
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800/80 hover:text-zinc-900 dark:hover:text-white transition-colors"
            >
              <BookOpen className="h-3.5 w-3.5 text-zinc-400 dark:text-zinc-500" />
              <span>{t.help.documentation}</span>
            </Link>

            <a
              href="mailto:support@companybrain.io?subject=Support%20Request"
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800/80 hover:text-zinc-900 dark:hover:text-white transition-colors"
            >
              <MessageSquare className="h-3.5 w-3.5 text-zinc-400 dark:text-zinc-500" />
              <span>{t.help.getSupport}</span>
            </a>

            {/* More Submenu Trigger */}
            <div
              className="relative"
              onMouseEnter={() => setIsMoreOpen(true)}
              onMouseLeave={() => setIsMoreOpen(false)}
            >
              <button
                type="button"
                onClick={() => setIsMoreOpen(!isMoreOpen)}
                className={cn(
                  "flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800/80 hover:text-zinc-900 dark:hover:text-white transition-colors",
                  isMoreOpen && "bg-zinc-100 dark:bg-zinc-800/80 text-zinc-900 dark:text-white"
                )}
              >
                <div className="flex items-center gap-2.5">
                  <MoreHorizontal className="h-3.5 w-3.5 text-zinc-400 dark:text-zinc-500" />
                  <span>{t.help.more}</span>
                </div>
                <ChevronRight className="h-3 w-3 text-zinc-400 dark:text-zinc-500" />
              </button>

              {/* Sub-menu (Flyout to the right) */}
              {isMoreOpen && (
                <div
                  className={cn(
                    "absolute left-full ml-1 w-60 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#161618] p-1.5 shadow-2xl backdrop-blur-2xl text-zinc-800 dark:text-zinc-200 z-50 animate-in fade-in",
                    placement === "top" ? "top-0" : "bottom-0"
                  )}
                >
                  <div className="space-y-0.5">
                    <button
                      type="button"
                      onClick={() => {
                        setShowShortcutsModal(true);
                        setIsOpen(false);
                      }}
                      className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-xs text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800/80 hover:text-zinc-900 dark:hover:text-white transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <Keyboard className="h-3.5 w-3.5 text-zinc-400 dark:text-zinc-500" />
                        <span>{t.help.keyboardShortcuts}</span>
                      </div>
                      <kbd className="rounded border border-zinc-200 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 px-1 text-[9px] font-mono text-zinc-600 dark:text-zinc-400">
                        {formatShortcut("/", true)}
                      </kbd>
                    </button>

                    <a
                      href="https://twitter.com"
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center justify-between rounded-lg px-2.5 py-1.5 text-xs text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800/80 hover:text-zinc-900 dark:hover:text-white transition-colors"
                    >
                      <span>X (formerly Twitter)</span>
                      <ExternalLink className="h-3 w-3 text-zinc-400 dark:text-zinc-500" />
                    </a>

                    <Link
                      href="/pricing"
                      onClick={() => setIsOpen(false)}
                      className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800/80 hover:text-zinc-900 dark:hover:text-white transition-colors"
                    >
                      <FileText className="h-3.5 w-3.5 text-zinc-400 dark:text-zinc-500" />
                      <span>{t.help.termsPrivacy}</span>
                    </Link>

                    <div className="flex items-center justify-between rounded-lg px-2.5 py-1.5 text-xs text-zinc-700 dark:text-zinc-300">
                      <div className="flex items-center gap-2">
                        <Activity className="h-3.5 w-3.5 text-emerald-500 dark:text-emerald-400" />
                        <span>{t.help.status}</span>
                      </div>
                      <span className="flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-pulse" />
                        {t.common.operational}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={handleClearCache}
                      className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-xs text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800/80 hover:text-zinc-900 dark:hover:text-white transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <RotateCcw className="h-3.5 w-3.5 text-zinc-400 dark:text-zinc-500" />
                        <span>{t.help.clearCache}</span>
                      </div>
                      {cacheCleared && <Check className="h-3 w-3 text-emerald-500 dark:text-emerald-400" />}
                    </button>
                  </div>

                  <div className="my-1.5 border-t border-zinc-200 dark:border-zinc-800" />

                  {/* Version Footnote */}
                  <div className="px-2.5 py-1 text-[10px] font-mono text-zinc-500 dark:text-zinc-400 leading-tight space-y-0.5">
                    <p className="text-zinc-700 dark:text-zinc-300 font-semibold">Company Brain 0.5.0</p>
                    <p>{t.help.webCloudEdition}</p>
                    <p className="text-zinc-400 dark:text-zinc-500">{t.help.updatedToday}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="my-1.5 border-t border-zinc-200 dark:border-zinc-800" />

          {/* What's new? Section with connected vertical timeline */}
          <div className="px-2 py-1">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-2">
              {t.help.whatsNew}
            </p>

            <div className="relative pl-3.5 space-y-2 border-l border-slate-700/60 ml-1.5">
              <div className="relative">
                <div className="absolute -left-[19px] top-1.5 h-1.5 w-1.5 rounded-full bg-blue-500 ring-2 ring-slate-900" />
                <p className="text-xs font-medium text-slate-200">Company Brain 0.5</p>
                <p className="text-[10px] text-slate-400">Unified memory layer</p>
              </div>

              <div className="relative">
                <div className="absolute -left-[19px] top-1.5 h-1.5 w-1.5 rounded-full bg-slate-500 ring-2 ring-slate-900" />
                <p className="text-xs font-medium text-slate-200">Interactive Timeline</p>
                <p className="text-[10px] text-slate-400">Continuous pan & zoom</p>
              </div>

              <div className="relative">
                <div className="absolute -left-[19px] top-1.5 h-1.5 w-1.5 rounded-full bg-slate-500 ring-2 ring-slate-900" />
                <p className="text-xs font-medium text-slate-200">Google Workspace Sync</p>
                <p className="text-[10px] text-slate-400">Gmail & Calendar connected</p>
              </div>
            </div>

            <Link
              href="/dashboard"
              onClick={() => setIsOpen(false)}
              className="mt-3 flex items-center gap-2 rounded-lg px-1.5 py-1 text-xs font-medium text-blue-400 hover:text-blue-300 transition-colors"
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>{t.help.viewAllReleases}</span>
            </Link>
          </div>
        </div>
      )}

      {/* Keyboard Shortcuts Dialog Modal */}
      {showShortcutsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-sm rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#161618] p-5 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-200 dark:border-zinc-800">
              <div className="flex items-center gap-2">
                <Keyboard className="h-4 w-4 text-blue-500 dark:text-blue-400" />
                <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">{t.help.shortcutsTitle}</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowShortcutsModal(false)}
                className="p-1 rounded-md text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="py-3 space-y-2.5 text-xs">
              <div className="flex items-center justify-between text-zinc-700 dark:text-zinc-300">
                <span>{t.help.quickSearch}</span>
                <kbd className="rounded border border-zinc-300 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 text-[10px] font-mono text-zinc-700 dark:text-zinc-300">
                  {formatShortcut("K", true)}
                </kbd>
              </div>
              <div className="flex items-center justify-between text-zinc-700 dark:text-zinc-300">
                <span>{t.help.zoomTimeline}</span>
                <kbd className="rounded border border-zinc-300 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 text-[10px] font-mono text-zinc-700 dark:text-zinc-300">
                  {modKeyName} + Scroll
                </kbd>
              </div>
              <div className="flex items-center justify-between text-zinc-700 dark:text-zinc-300">
                <span>{t.help.panTimeline}</span>
                <kbd className="rounded border border-zinc-300 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 text-[10px] font-mono text-zinc-700 dark:text-zinc-300">
                  Click & Drag
                </kbd>
              </div>
              <div className="flex items-center justify-between text-zinc-700 dark:text-zinc-300">
                <span>{t.help.closeModal}</span>
                <kbd className="rounded border border-zinc-300 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 text-[10px] font-mono text-zinc-700 dark:text-zinc-300">
                  Esc
                </kbd>
              </div>
            </div>

            <div className="pt-3 border-t border-zinc-200 dark:border-zinc-800 text-right">
              <button
                type="button"
                onClick={() => setShowShortcutsModal(false)}
                className="rounded-lg bg-blue-600 px-3 py-1 text-xs font-semibold text-white hover:bg-blue-500 transition-colors"
              >
                {t.common.gotIt}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
