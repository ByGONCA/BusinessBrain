"use client";

import * as React from "react";
import { Download, ShieldCheck, FileText, Database, Loader2, Check, AlertCircle } from "lucide-react";
import { OrganizationWithRole } from "@/lib/organizations/types";
import { exportPersonalDataAction, exportWorkspaceDataAction } from "@/lib/settings/actions";

interface PrivacyDataTabProps {
  activeOrg: OrganizationWithRole | null;
}

export function PrivacyDataTab({ activeOrg }: PrivacyDataTabProps) {
  const isOwnerOrAdmin = activeOrg?.role === "owner" || activeOrg?.role === "admin";

  const [downloadingPersonal, setDownloadingPersonal] = React.useState(false);
  const [downloadingWorkspace, setDownloadingWorkspace] = React.useState(false);
  const [personalSuccess, setPersonalSuccess] = React.useState(false);
  const [workspaceSuccess, setWorkspaceSuccess] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  const downloadJson = (data: unknown, filename: string) => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleExportPersonal = async () => {
    setDownloadingPersonal(true);
    setErrorMsg(null);
    try {
      const res = await exportPersonalDataAction();
      if (res.success && res.data) {
        downloadJson(res.data, `company-brain-personal-data-${new Date().toISOString().slice(0, 10)}.json`);
        setPersonalSuccess(true);
        setTimeout(() => setPersonalSuccess(false), 3000);
      } else {
        setErrorMsg(res.error || "Failed to export personal data.");
      }
    } catch {
      setErrorMsg("An error occurred during personal export.");
    } finally {
      setDownloadingPersonal(false);
    }
  };

  const handleExportWorkspace = async () => {
    if (!activeOrg?.id) return;
    setDownloadingWorkspace(true);
    setErrorMsg(null);
    try {
      const res = await exportWorkspaceDataAction(activeOrg.id);
      if (res.success && res.data) {
        downloadJson(res.data, `${activeOrg.slug || "workspace"}-data-export-${new Date().toISOString().slice(0, 10)}.json`);
        setWorkspaceSuccess(true);
        setTimeout(() => setWorkspaceSuccess(false), 3000);
      } else {
        setErrorMsg(res.error || "Failed to export workspace data.");
      }
    } catch {
      setErrorMsg("An error occurred during workspace export.");
    } finally {
      setDownloadingWorkspace(false);
    }
  };

  return (
    <div className="space-y-6 max-w-xl">
      <div>
        <h2 className="text-lg font-bold text-zinc-900 dark:text-white tracking-tight">Privacy & Data Management</h2>
        <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-0.5">
          Request data exports, review compliance guarantees, and govern personal and organization data ownership.
        </p>
      </div>

      {errorMsg && (
        <div className="p-3 rounded-lg border border-red-200 dark:border-red-900 bg-red-50/50 dark:bg-red-950/20 text-xs text-red-600 dark:text-red-400 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Data Export Cards */}
      <div className="space-y-3">
        <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
          Data Portability & Export
        </span>

        {/* Personal Data Export */}
        <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#1a1a1d] flex items-center justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">Export Personal Account Data</p>
            </div>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
              Download your profile details, notification preferences, and memberships as a machine-readable JSON file.
            </p>
          </div>
          <button
            type="button"
            onClick={handleExportPersonal}
            disabled={downloadingPersonal}
            className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-[#1a1a1d] px-3 py-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50 shrink-0 cursor-pointer"
          >
            {downloadingPersonal ? (
              <>
                <Loader2 className="h-3 w-3 animate-spin" />
                <span>Exporting...</span>
              </>
            ) : personalSuccess ? (
              <>
                <Check className="h-3 w-3 text-emerald-500" />
                <span>Exported</span>
              </>
            ) : (
              <>
                <Download className="h-3 w-3" />
                <span>Export JSON</span>
              </>
            )}
          </button>
        </div>

        {/* Workspace Data Export */}
        <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#1a1a1d] flex items-center justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Database className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
              <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">Export Entire Workspace Data</p>
            </div>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
              Full workspace snapshot including members, metadata, and configuration (Owners & Admins only).
            </p>
          </div>
          <button
            type="button"
            onClick={handleExportWorkspace}
            disabled={!isOwnerOrAdmin || downloadingWorkspace}
            className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-[#1a1a1d] px-3 py-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50 shrink-0 cursor-pointer"
          >
            {downloadingWorkspace ? (
              <>
                <Loader2 className="h-3 w-3 animate-spin" />
                <span>Exporting...</span>
              </>
            ) : workspaceSuccess ? (
              <>
                <Check className="h-3 w-3 text-emerald-500" />
                <span>Exported</span>
              </>
            ) : (
              <>
                <Download className="h-3 w-3" />
                <span>Export Workspace</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Compliance & Privacy Guarantees */}
      <div className="space-y-3 pt-2">
        <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
          Compliance & Data Retention
        </span>

        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/40 p-4 space-y-3 text-xs">
          <div className="flex items-start gap-2.5">
            <ShieldCheck className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-semibold text-zinc-900 dark:text-zinc-100">GDPR & Tenant Isolation</p>
              <p className="text-[11px] text-zinc-600 dark:text-zinc-400 leading-relaxed">
                Your workspace documents, tasks, and meeting notes are compartmentalized using PostgreSQL Row-Level Security. We do not sell or train external models on proprietary tenant data without explicit permission.
              </p>
            </div>
          </div>

          <div className="pt-2 border-t border-zinc-200 dark:border-zinc-800 flex items-start gap-2.5">
            <Database className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-semibold text-zinc-900 dark:text-zinc-100">Encryption at Rest & In Transit</p>
              <p className="text-[11px] text-zinc-600 dark:text-zinc-400 leading-relaxed">
                All network communication utilizes TLS 1.3 encryption. OAuth credentials and third-party tokens are AES-256 encrypted before persistence.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
