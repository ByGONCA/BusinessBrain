"use client";

import * as React from "react";
import { Building2, AlertTriangle, Shield, Check, Loader2, Trash2, ArrowRightLeft } from "lucide-react";
import { OrganizationWithRole } from "@/lib/organizations/types";
import { updateWorkspaceGeneralAction } from "@/lib/settings/actions";

interface WorkspaceGeneralTabProps {
  activeOrg: OrganizationWithRole | null;
}

const INDUSTRIES = [
  "Technology & Software",
  "Financial Services & Fintech",
  "Design & Creative Agency",
  "Healthcare & Life Sciences",
  "Consulting & Professional Services",
  "E-Commerce & Retail",
  "Education & EdTech",
  "Media & Entertainment",
  "Real Estate",
  "Other",
];

const COMPANY_SIZES = [
  "1-10 employees",
  "11-50 employees",
  "51-200 employees",
  "201-500 employees",
  "500+ employees",
];

export function WorkspaceGeneralTab({ activeOrg }: WorkspaceGeneralTabProps) {
  const isOwnerOrAdmin = activeOrg?.role === "owner" || activeOrg?.role === "admin";
  const isOwner = activeOrg?.role === "owner";

  const [name, setName] = React.useState(activeOrg?.name || "");
  const [logoUrl, setLogoUrl] = React.useState(activeOrg?.logo_url || "");
  const [description, setDescription] = React.useState(activeOrg?.description || "");
  const [industry, setIndustry] = React.useState(activeOrg?.industry || "Technology & Software");
  const [companySize, setCompanySize] = React.useState(activeOrg?.company_size || "1-10 employees");
  const [country, setCountry] = React.useState(activeOrg?.country || "Portugal");

  const [isSaving, setIsSaving] = React.useState(false);
  const [statusMessage, setStatusMessage] = React.useState<{ success?: boolean; message?: string } | null>(null);

  // Danger zone modal state
  const [dangerConfirmOpen, setDangerConfirmOpen] = React.useState<"delete" | "transfer" | null>(null);
  const [deleteInputName, setDeleteInputName] = React.useState("");

  React.useEffect(() => {
    if (activeOrg) {
      setName(activeOrg.name || "");
      setLogoUrl(activeOrg.logo_url || "");
      setDescription(activeOrg.description || "");
      if (activeOrg.industry) setIndustry(activeOrg.industry);
      if (activeOrg.company_size) setCompanySize(activeOrg.company_size);
      if (activeOrg.country) setCountry(activeOrg.country);
    }
  }, [activeOrg]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeOrg?.id) return;
    setIsSaving(true);
    setStatusMessage(null);
    try {
      const res = await updateWorkspaceGeneralAction(activeOrg.id, {
        name,
        logoUrl,
        description,
        industry,
        companySize,
        country,
      });
      if (res.success) {
        setStatusMessage({ success: true, message: "Workspace settings updated." });
        setTimeout(() => setStatusMessage(null), 3000);
      } else {
        setStatusMessage({ success: false, message: res.error || "Failed to update workspace." });
      }
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-xl">
      <div>
        <h2 className="text-lg font-bold text-zinc-900 dark:text-white tracking-tight">Workspace General Settings</h2>
      </div>

      <form onSubmit={handleSave} className="space-y-5">
        {/* Workspace Identity Preview */}
        <div className="flex items-center gap-4 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/40">
          <div className="relative group shrink-0">
            {logoUrl ? (
              <img
                src={logoUrl}
                alt={name || "Workspace Logo"}
                className="h-14 w-14 rounded-xl object-contain border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 p-1 shadow-xs"
              />
            ) : (
              <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 font-bold text-lg border border-zinc-300 dark:border-zinc-700">
                <Building2 className="h-6 w-6 text-zinc-500" />
              </div>
            )}
          </div>
          <div className="flex-1 space-y-1">
            <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{name || "Untitled Workspace"}</p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Slug: <code className="font-mono text-[11px] text-zinc-600 dark:text-zinc-300">{activeOrg?.slug}</code>
            </p>
            <div className="flex items-center gap-2">
              <span className="rounded bg-blue-500/10 px-1.5 py-0.2 text-[9px] font-mono font-semibold text-blue-600 dark:text-blue-400 border border-blue-500/20 uppercase">
                {activeOrg?.role || "Member"}
              </span>
            </div>
          </div>
        </div>

        {/* Company Identity Fields */}
        <div className="space-y-3">
          <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Company Identity
          </span>

          {/* Workspace Name */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">Workspace / Company Name</label>
            <input
              type="text"
              disabled={!isOwnerOrAdmin}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Acme Corporation"
              className="w-full rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#1a1a1d] px-3 py-1.5 text-xs text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:border-blue-500 transition-colors disabled:opacity-50"
            />
          </div>

          {/* Company Logo URL */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">Company Logo URL</label>
            <input
              type="url"
              disabled={!isOwnerOrAdmin}
              value={logoUrl}
              onChange={(e) => setLogoUrl(e.target.value)}
              placeholder="https://example.com/logo.svg"
              className="w-full rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#1a1a1d] px-3 py-1.5 text-xs text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:border-blue-500 transition-colors disabled:opacity-50"
            />
            <p className="text-[10px] text-zinc-500">Square or transparent SVG/PNG works best for company branding.</p>
          </div>

          {/* Description */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">Short Description / Mission</label>
            <textarea
              rows={2}
              disabled={!isOwnerOrAdmin}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What does your company do?"
              className="w-full rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#1a1a1d] px-3 py-1.5 text-xs text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:border-blue-500 transition-colors disabled:opacity-50 resize-none"
            />
          </div>

          {/* Industry & Size */}
          <div className="grid grid-cols-2 gap-3 pt-1">
            <div className="space-y-1">
              <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">Industry</label>
              <select
                disabled={!isOwnerOrAdmin}
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
                className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-[#1a1a1d] px-2.5 py-1.5 text-xs font-medium text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-blue-500 disabled:opacity-50 cursor-pointer"
              >
                {INDUSTRIES.map((ind) => (
                  <option key={ind} value={ind}>
                    {ind}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">Company Size</label>
              <select
                disabled={!isOwnerOrAdmin}
                value={companySize}
                onChange={(e) => setCompanySize(e.target.value)}
                className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-[#1a1a1d] px-2.5 py-1.5 text-xs font-medium text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-blue-500 disabled:opacity-50 cursor-pointer"
              >
                {COMPANY_SIZES.map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Country */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">Country / Headquarters</label>
            <input
              type="text"
              disabled={!isOwnerOrAdmin}
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              placeholder="e.g. Portugal"
              className="w-full rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#1a1a1d] px-3 py-1.5 text-xs text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:border-blue-500 transition-colors disabled:opacity-50"
            />
          </div>
        </div>

        {/* Save button */}
        {isOwnerOrAdmin && (
          <div className="pt-2 flex items-center justify-between">
            <span className="text-[11px] text-zinc-500">
              {statusMessage && (
                <span
                  className={`flex items-center gap-1 font-medium ${
                    statusMessage.success
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-red-500"
                  }`}
                >
                  {statusMessage.success && <Check className="h-3.5 w-3.5" />}
                  {statusMessage.message}
                </span>
              )}
            </span>
            <button
              type="submit"
              disabled={isSaving}
              className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-900 dark:bg-white px-4 py-1.5 text-xs font-semibold text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-100 transition-colors disabled:opacity-50 cursor-pointer"
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-3 w-3 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <span>Save Workspace</span>
              )}
            </button>
          </div>
        )}
      </form>

      {/* Danger Zone */}
      {isOwner && (
        <div className="space-y-3 pt-6 border-t border-red-200 dark:border-red-950/60">
          <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
            <AlertTriangle className="h-4 w-4" />
            <h3 className="text-xs font-bold uppercase tracking-wider">Danger Zone</h3>
          </div>
          <p className="text-xs text-zinc-600 dark:text-zinc-400">
            These operations are destructive or irreversible. Exercise caution.
          </p>

          <div className="rounded-xl border border-red-200 dark:border-red-900/40 bg-red-50/20 dark:bg-red-950/10 p-3.5 space-y-3">
            {/* Transfer Ownership */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">Transfer Workspace Ownership</p>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                  Transfer the primary owner role to another verified administrator.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDangerConfirmOpen("transfer")}
                className="flex items-center gap-1 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-[#1a1a1d] px-2.5 py-1 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
              >
                <ArrowRightLeft className="h-3 w-3" />
                <span>Transfer</span>
              </button>
            </div>

            {/* Delete Workspace */}
            <div className="flex items-center justify-between pt-2 border-t border-red-200/60 dark:border-red-900/30">
              <div>
                <p className="text-xs font-semibold text-red-600 dark:text-red-400">Delete this workspace</p>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                  Permanently erase all documents, tasks, subscriptions, and member access.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDangerConfirmOpen("delete")}
                className="flex items-center gap-1 rounded-lg bg-red-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-red-700 transition-colors"
              >
                <Trash2 className="h-3 w-3" />
                <span>Delete</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal for Delete Workspace */}
      {dangerConfirmOpen === "delete" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl border border-red-300 dark:border-red-900 bg-white dark:bg-[#1a1a1d] p-5 shadow-2xl space-y-4 text-zinc-900 dark:text-zinc-100">
            <div className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              <h4 className="font-bold text-sm">Delete Workspace Permanently?</h4>
            </div>
            <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
              This action cannot be undone. All documents, notes, meetings, and integrations in{" "}
              <strong>{activeOrg?.name}</strong> will be permanently purged.
            </p>
            <div className="space-y-1">
              <label className="text-[11px] text-zinc-500">
                To confirm, type <strong>{activeOrg?.name}</strong> below:
              </label>
              <input
                type="text"
                value={deleteInputName}
                onChange={(e) => setDeleteInputName(e.target.value)}
                placeholder={activeOrg?.name}
                className="w-full rounded-lg border border-red-300 dark:border-red-900/60 bg-red-50/20 dark:bg-red-950/20 px-3 py-1.5 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-red-500"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setDangerConfirmOpen(null);
                  setDeleteInputName("");
                }}
                className="rounded-lg border border-zinc-300 dark:border-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleteInputName.trim() !== activeOrg?.name}
                onClick={() => {
                  alert("Please contact enterprise support to complete organization removal.");
                  setDangerConfirmOpen(null);
                }}
                className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-40"
              >
                I understand, delete workspace
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal for Transfer */}
      {dangerConfirmOpen === "transfer" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl border border-zinc-300 dark:border-zinc-800 bg-white dark:bg-[#1a1a1d] p-5 shadow-2xl space-y-4 text-zinc-900 dark:text-zinc-100">
            <h4 className="font-bold text-sm">Transfer Workspace Ownership</h4>
            <p className="text-xs text-zinc-600 dark:text-zinc-400">
              Select an administrator from the People tab to assign primary ownership privileges.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDangerConfirmOpen(null)}
                className="rounded-lg border border-zinc-300 dark:border-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
