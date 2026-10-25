"use client";

import * as React from "react";
import { AlertCircle, RotateCcw, X, RefreshCw, Home } from "lucide-react";

export interface ErrorNoticeProps {
  /**
   * Title of the error
   */
  title?: string;
  /**
   * Explanatory text for the user
   */
  message: string;
  /**
   * Optional technical error code or digest reference
   */
  digest?: string;
  /**
   * Action triggered by "Try again"
   */
  onRetry?: () => void;
  /**
   * Action triggered when dismissed (toast mode)
   */
  onDismiss?: () => void;
  /**
   * Display variant:
   * - 'toast': floating non-blocking notification in bottom-left corner
   * - 'inline': embedded within card or section
   */
  variant?: "toast" | "inline";
  /**
   * Custom CSS classes
   */
  className?: string;
}

/**
 * ErrorNotice - Non-blocking recoverable error alert
 * Used for network glitches, retryable mutations, and component-level issues.
 */
export function ErrorNotice({
  title = "Action failed",
  message,
  digest,
  onRetry,
  onDismiss,
  variant = "toast",
  className = "",
}: ErrorNoticeProps) {
  const [isRetrying, setIsRetrying] = React.useState(false);

  const handleRetry = async () => {
    if (!onRetry || isRetrying) return;
    setIsRetrying(true);
    try {
      await onRetry();
    } finally {
      setIsRetrying(false);
    }
  };

  if (variant === "toast") {
    return (
      <aside
        aria-live="polite"
        role="status"
        className={`fixed bottom-6 left-6 z-50 flex items-start gap-3.5 max-w-sm sm:max-w-md rounded-xl bg-[#120b0d]/95 p-3.5 sm:p-4 text-white shadow-2xl shadow-black/80 border border-[#3e1b21] backdrop-blur-md animate-in fade-in slide-in-from-bottom-3 duration-200 pointer-events-auto selection:bg-[#ef4444]/25 ${className}`}
      >
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-red-950/60 border border-red-800/40 text-red-400">
          <AlertCircle className="h-4 w-4" />
        </div>

        <div className="flex-1 min-w-0 pr-1">
          <h4 className="text-xs font-semibold text-red-200 tracking-tight">
            {title}
          </h4>
          <p className="mt-0.5 text-xs text-[#d1c8c9] leading-relaxed break-words">
            {message}
          </p>

          {digest && (
            <p className="mt-1 text-[10px] font-mono text-red-400/70">
              Ref: {digest}
            </p>
          )}

          {onRetry && (
            <div className="mt-2.5 flex items-center gap-2">
              <button
                type="button"
                onClick={handleRetry}
                disabled={isRetrying}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#251317] hover:bg-[#34181f] text-red-300 hover:text-white px-2.5 py-1 text-xs font-medium border border-red-900/40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 disabled:opacity-60"
              >
                <RotateCcw className={`h-3 w-3 ${isRetrying ? "animate-spin" : ""}`} />
                <span>{isRetrying ? "Retrying..." : "Try again"}</span>
              </button>
            </div>
          )}
        </div>

        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Dismiss error notification"
            className="shrink-0 rounded-md p-1 text-[#a89d9f] hover:text-white hover:bg-white/5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </aside>
    );
  }

  // Inline variant
  return (
    <div
      role="alert"
      className={`flex items-start gap-3 rounded-xl bg-[#140c0f]/90 border border-[#3b171d] p-3.5 text-xs text-[#e2d9db] backdrop-blur-sm ${className}`}
    >
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-red-950/60 border border-red-800/40 text-red-400">
        <AlertCircle className="h-3.5 w-3.5" />
      </div>
      <div className="flex-1 min-w-0">
        <span className="font-semibold text-red-300 block">{title}</span>
        <span className="mt-0.5 text-[#cfc5c7] block leading-relaxed">{message}</span>
        {digest && (
          <span className="mt-1 block text-[10px] font-mono text-red-400/70">
            Ref: {digest}
          </span>
        )}
      </div>
      {onRetry && (
        <button
          type="button"
          onClick={handleRetry}
          disabled={isRetrying}
          className="shrink-0 inline-flex items-center gap-1.5 rounded-lg bg-[#231215] hover:bg-[#32171d] text-red-300 hover:text-white px-2.5 py-1 text-xs font-medium border border-red-900/40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
        >
          <RotateCcw className={`h-3 w-3 ${isRetrying ? "animate-spin" : ""}`} />
          <span>{isRetrying ? "Retrying..." : "Try again"}</span>
        </button>
      )}
    </div>
  );
}

export interface ErrorPanelProps {
  /**
   * Title of the critical error
   */
  title?: string;
  /**
   * Detailed explanation
   */
  description?: string;
  /**
   * Optional Next.js digest reference code
   */
  digest?: string;
  /**
   * Function to reset/retry error boundary
   */
  onRetry?: () => void;
  /**
   * Whether to show "Refresh page" button
   */
  showRefresh?: boolean;
  /**
   * Whether to show "Dashboard" navigation button
   */
  showDashboardLink?: boolean;
  /**
   * Optional container styling override
   */
  className?: string;
}

/**
 * ErrorPanel - Full-featured error card for root and nested error boundaries
 * Matches the dark/red obsidian design system of the 404 page.
 */
export function ErrorPanel({
  title = "Something went wrong",
  description = "A temporary server or network interruption occurred. You can retry the action or refresh the page without losing your workspace state.",
  digest,
  onRetry,
  showRefresh = true,
  showDashboardLink = false,
  className = "",
}: ErrorPanelProps) {
  const [isRetrying, setIsRetrying] = React.useState(false);

  const handleRetry = async () => {
    if (!onRetry || isRetrying) return;
    setIsRetrying(true);
    try {
      await onRetry();
    } finally {
      setIsRetrying(false);
    }
  };

  const handleRefresh = () => {
    if (typeof window !== "undefined") {
      window.location.reload();
    }
  };

  return (
    <div
      role="alert"
      className={`w-full max-w-md sm:max-w-lg rounded-2xl border border-[#3e1920] bg-[#100a0d]/95 p-7 sm:p-9 shadow-2xl shadow-black/90 text-center animate-in fade-in duration-200 backdrop-blur-xl selection:bg-[#ef4444]/25 ${className}`}
    >
      {/* Icon with subtle red aura */}
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-red-950/50 border border-red-800/40 text-[#ef4444] shadow-lg shadow-red-950/30">
        <AlertCircle className="h-6 w-6" />
      </div>

      <h2 className="text-xl font-medium tracking-tight text-white">
        {title}
      </h2>

      <p className="mt-2 text-xs sm:text-sm text-[#cfc5c7] leading-relaxed">
        {description}
      </p>

      {digest && (
        <div className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[#180d10] border border-[#38161b] px-3 py-1.5 text-left">
          <span className="text-[11px] font-mono text-red-300/80">
            Error Ref: {digest}
          </span>
        </div>
      )}

      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        {onRetry && (
          <button
            type="button"
            onClick={handleRetry}
            disabled={isRetrying}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#1e1014] hover:bg-[#2c151b] active:scale-[0.98] text-[#f2eceb] hover:text-white px-5 py-2.5 text-xs sm:text-sm font-medium border border-[#4a1c24] hover:border-[#6a2532] transition-all duration-200 shadow-md hover:shadow-red-950/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ef4444] disabled:opacity-60"
          >
            <RotateCcw className={`h-3.5 w-3.5 ${isRetrying ? "animate-spin" : ""}`} />
            <span>{isRetrying ? "Retrying..." : "Try again"}</span>
          </button>
        )}

        {showRefresh && (
          <button
            type="button"
            onClick={handleRefresh}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#120c0e] hover:bg-[#1a1114] active:scale-[0.98] text-[#cfc5c7] hover:text-white px-5 py-2.5 text-xs sm:text-sm font-medium border border-[#2e151a] hover:border-[#461e25] transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ef4444]"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Refresh page</span>
          </button>
        )}

        {showDashboardLink && (
          <a
            href="/dashboard"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#120c0e] hover:bg-[#1a1114] active:scale-[0.98] text-[#cfc5c7] hover:text-white px-5 py-2.5 text-xs sm:text-sm font-medium border border-[#2e151a] hover:border-[#461e25] transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ef4444]"
          >
            <Home className="h-3.5 w-3.5" />
            <span>Dashboard</span>
          </a>
        )}
      </div>
    </div>
  );
}
