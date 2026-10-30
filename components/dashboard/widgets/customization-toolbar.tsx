"use client";

import * as React from "react";
import {
  SlidersHorizontal,
  Plus,
  RotateCcw,
  X,
  Check,
  Loader2,
  AlertTriangle,
  RefreshCw,
  AlertCircle,
} from "lucide-react";
import { DashboardType } from "@/lib/widgets/types";
import { useLanguage } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export interface CustomizationToolbarProps {
  dashboardType: DashboardType;
  hasUnsavedChanges: boolean;
  isSaving: boolean;
  saveFeedback?: {
    type: "success" | "error" | "conflict";
    message: string;
    currentUpdatedAt?: string;
  } | null;
  onAddWidget: () => void;
  onRestoreDefaults: () => void;
  onCancel: () => void;
  onSave: () => void;
  onReloadLatest?: () => void;
  onForceOverwrite?: () => void;
  className?: string;
}

export function CustomizationToolbar({
  dashboardType,
  hasUnsavedChanges,
  isSaving,
  saveFeedback,
  onAddWidget,
  onRestoreDefaults,
  onCancel,
  onSave,
  onReloadLatest,
  onForceOverwrite,
  className,
}: CustomizationToolbarProps) {
  const { t, interpolate } = useLanguage();

  const isHome = dashboardType === "home";
  const title = isHome ? t.widgets.customizingHome : t.widgets.customizingFinance;

  return (
    <div
      role="region"
      aria-label="Customization Toolbar"
      className={cn(
        "sticky top-2 z-30 mb-6 rounded-2xl border shadow-md transition-all duration-200",
        "border-blue-500/30 bg-white/95 dark:bg-[#16181D]/95 backdrop-blur-md p-3 sm:p-4",
        className
      )}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Left: Indicator & Status */}
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 shrink-0">
            <SlidersHorizontal className="h-4 w-4" />
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-xs sm:text-sm font-bold text-zinc-900 dark:text-zinc-100 tracking-tight truncate">
                {title}
              </h2>

              {hasUnsavedChanges && (
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/40 px-2 py-0.5 rounded-md shrink-0">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
                  {t.widgets.unsaved}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex flex-wrap items-center gap-1.5 shrink-0">
          {/* + Add Widget */}
          <button
            type="button"
            onClick={onAddWidget}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-blue-600 hover:bg-blue-500 text-white shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>{t.widgets.addWidget}</span>
          </button>

          {/* Restore Defaults */}
          <button
            type="button"
            onClick={onRestoreDefaults}
            title={t.widgets.defaultsTooltip}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-xl text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-800 transition-colors cursor-pointer"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{t.widgets.defaults}</span>
          </button>

          {/* Cancel */}
          <button
            type="button"
            onClick={onCancel}
            disabled={isSaving}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-xl text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors cursor-pointer"
          >
            <X className="h-3.5 w-3.5" />
            <span>{t.widgets.cancel}</span>
          </button>

          {/* Save Layout (Atomic CAS) */}
          <button
            type="button"
            onClick={onSave}
            disabled={isSaving}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-100 transition-colors disabled:opacity-50 cursor-pointer shadow-xs"
          >
            {isSaving ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>{t.widgets.saving}</span>
              </>
            ) : (
              <>
                <Check className="h-3.5 w-3.5" />
                <span>{t.widgets.save}</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* FEEDBACK BANNERS */}
      {saveFeedback && (
        <div className="mt-3 pt-3 border-t border-zinc-100 dark:border-white/[0.06]">
          {saveFeedback.type === "success" && (
            <div className="flex items-center gap-2 text-xs text-emerald-700 dark:text-emerald-400 font-medium">
              <Check className="h-4 w-4 shrink-0" />
              <span>{saveFeedback.message}</span>
            </div>
          )}

          {saveFeedback.type === "error" && (
            <div className="flex items-center gap-2 text-xs text-rose-700 dark:text-rose-400 font-medium">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{saveFeedback.message}</span>
            </div>
          )}

          {/* STALE_WRITE OCC CONFLICT RESOLUTION */}
          {saveFeedback.type === "conflict" && (
            <div className="rounded-xl border border-amber-300 dark:border-amber-800/80 bg-amber-50 dark:bg-amber-950/40 p-3 text-xs space-y-2">
              <div className="flex items-start gap-2 text-amber-800 dark:text-amber-300">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
                <div>
                  <p className="font-semibold">
                    {t.widgets.conflictTitle}
                  </p>
                  <p className="text-[11px] text-amber-700 dark:text-amber-400 mt-0.5">
                    {interpolate(t.widgets.conflictDesc, {
                      updatedAt: saveFeedback.currentUpdatedAt || "recently",
                    })}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1 pl-6">
                {/* Recommended: Reload and Review */}
                {onReloadLatest && (
                  <button
                    type="button"
                    onClick={onReloadLatest}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-medium text-[11px] shadow-xs transition-colors cursor-pointer"
                  >
                    <RefreshCw className="h-3 w-3" />
                    <span>{t.widgets.reloadReview}</span>
                  </button>
                )}

                {/* Secondary: Force Overwrite */}
                {onForceOverwrite && (
                  <button
                    type="button"
                    onClick={onForceOverwrite}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-amber-400 dark:border-amber-700 text-amber-800 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-900/60 font-medium text-[11px] transition-colors cursor-pointer"
                  >
                    <span>{t.widgets.forceOverwrite}</span>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
