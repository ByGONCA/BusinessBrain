"use client";

import * as React from "react";
import { HardDrive, Server, FileText, ExternalLink, RefreshCw, CheckCircle, AlertTriangle } from "lucide-react";
import { OrganizationWithRole } from "@/lib/organizations/types";
import { getOrganizationStorageStatsAction } from "@/lib/settings/actions";
import { useSettings } from "./settings-context";

interface StorageTabProps {
  activeOrg: OrganizationWithRole | null;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 MB";
  const mb = bytes / (1024 * 1024);
  if (mb < 1024) {
    return `${mb.toFixed(1)} MB`;
  }
  const gb = mb / 1024;
  return `${gb.toFixed(2)} GB`;
}

export function StorageTab({ activeOrg }: StorageTabProps) {
  const { openSettings } = useSettings();

  const [loading, setLoading] = React.useState(true);
  const [quota, setQuota] = React.useState<{
    usedBytes: number;
    limitBytes: number;
    remainingBytes: number;
    usagePercentage: number;
    isQuotaExceeded: boolean;
    plan: string;
  } | null>(null);

  const loadStorage = React.useCallback(async () => {
    if (!activeOrg?.id) return;
    setLoading(true);
    try {
      const res = await getOrganizationStorageStatsAction(activeOrg.id);
      if (res.success && res.quota) {
        setQuota(res.quota);
      }
    } finally {
      setLoading(false);
    }
  }, [activeOrg?.id]);

  React.useEffect(() => {
    loadStorage();
  }, [loadStorage]);

  const usedFormatted = quota ? formatBytes(quota.usedBytes) : "0 MB";
  const limitFormatted = quota ? formatBytes(quota.limitBytes) : "5 GB";
  const percentage = quota?.usagePercentage || 0;

  return (
    <div className="space-y-6 max-w-xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-zinc-900 dark:text-white tracking-tight">Storage & Asset Quotas</h2>
          <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-0.5">
            Monitor file uploads, attached assets, and plan storage allocation for this workspace.
          </p>
        </div>
        <button
          type="button"
          onClick={loadStorage}
          disabled={loading}
          className="p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors cursor-pointer"
          title="Refresh storage quota"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Storage Meter Card */}
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#1a1a1d] p-4 space-y-3.5 shadow-xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400">
              <HardDrive className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                {usedFormatted} of {limitFormatted} used
              </p>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                {quota?.plan || "Starter"} Plan allocation
              </p>
            </div>
          </div>
          <span className="text-xs font-mono font-bold text-zinc-700 dark:text-zinc-300">
            {percentage}%
          </span>
        </div>

        {/* Progress bar */}
        <div className="w-full bg-zinc-100 dark:bg-zinc-800 h-2 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-300 rounded-full ${
              percentage > 90
                ? "bg-red-500"
                : percentage > 75
                ? "bg-amber-500"
                : "bg-blue-600"
            }`}
            style={{ width: `${Math.max(2, percentage)}%` }}
          />
        </div>

        <div className="flex items-center justify-between text-[11px] text-zinc-500 pt-1">
          <span>{formatBytes(quota?.remainingBytes || 0)} available</span>
          <button
            type="button"
            onClick={() => openSettings("billing")}
            className="text-blue-600 dark:text-blue-400 font-medium hover:underline inline-flex items-center gap-1 cursor-pointer"
          >
            Upgrade Plan <ExternalLink className="h-3 w-3" />
          </button>
        </div>
      </div>

      {/* Storage Breakdown Details */}
      <div className="space-y-3 pt-1">
        <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
          Storage Architecture
        </span>

        <div className="space-y-2">
          {/* Internal Company Brain Storage */}
          <div className="p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/40 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Server className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              <div>
                <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                  Company Brain Internal Storage
                </p>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                  Direct uploads, PDFs, images, and embedded page attachments.
                </p>
              </div>
            </div>
            <span className="text-xs font-mono font-semibold text-zinc-700 dark:text-zinc-300">
              {usedFormatted}
            </span>
          </div>

          {/* External Cloud Storage */}
          <div className="p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/40 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <FileText className="h-4 w-4 text-zinc-500" />
              <div>
                <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                  External Cloud Links & Google Drive
                </p>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                  Zero bytes consumed from Company Brain quota.
                </p>
              </div>
            </div>
            <span className="text-xs font-mono font-medium text-emerald-600 dark:text-emerald-400">
              0 MB (Unlimited)
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
