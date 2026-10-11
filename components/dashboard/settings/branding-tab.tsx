"use client";

import * as React from "react";
import { Mail, Shield, Check, Palette, Sparkles, Building2 } from "lucide-react";
import { OrganizationWithRole } from "@/lib/organizations/types";
import { updateOrganizationBrandingAction } from "@/lib/settings/actions";
import { cn } from "@/lib/utils";

interface BrandingTabProps {
  activeOrg: OrganizationWithRole | null;
}

export function BrandingTab({ activeOrg }: BrandingTabProps) {
  const isOwnerOrAdmin = activeOrg?.role === "owner" || activeOrg?.role === "admin";

  const [allowEmailDispatch, setAllowEmailDispatch] = React.useState(true);
  const [senderName, setSenderName] = React.useState(activeOrg?.name || "");
  const [footerText, setFooterText] = React.useState("Sent from " + (activeOrg?.name || "Company Brain"));
  const [brandColor, setBrandColor] = React.useState("#2563eb");
  const [isSaving, setIsSaving] = React.useState(false);
  const [saveStatus, setSaveStatus] = React.useState<{ success?: boolean; message?: string } | null>(null);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeOrg?.id) return;
    setIsSaving(true);
    setSaveStatus(null);
    try {
      const res = await updateOrganizationBrandingAction(activeOrg.id, {
        allowUserEmailDispatch: allowEmailDispatch,
        brandingSettings: {
          senderName: senderName.trim(),
          footerText: footerText.trim(),
          brandColor,
        },
      });
      if (res.success) {
        setSaveStatus({ success: true, message: res.message || "Branding updated successfully." });
        setTimeout(() => setSaveStatus(null), 3000);
      } else {
        setSaveStatus({ success: false, message: res.error || "Failed to update branding." });
      }
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-xl">
      <div>
        <h2 className="text-lg font-bold text-zinc-900 dark:text-white tracking-tight">Branding & Email Settings</h2>
      </div>

      <form onSubmit={handleSave} className="space-y-4">
        {/* Outbound Email Dispatch Master Toggle */}
        <div className="flex items-center justify-between p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/40">
          <div>
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                Outbound Email Dispatch
              </p>
            </div>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
              Allow members of this workspace to dispatch outbound notifications, digest summaries, and meeting invites.
            </p>
          </div>
          <button
            type="button"
            disabled={!isOwnerOrAdmin}
            onClick={() => setAllowEmailDispatch(!allowEmailDispatch)}
            className={cn(
              "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none disabled:opacity-40",
              allowEmailDispatch ? "bg-blue-600" : "bg-zinc-300 dark:bg-zinc-700"
            )}
          >
            <span
              className={cn(
                "pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition duration-200",
                allowEmailDispatch ? "translate-x-4" : "translate-x-0"
              )}
            />
          </button>
        </div>

        {/* Sender Name */}
        <div className="space-y-1.5 pt-1">
          <label className="block text-xs font-semibold text-zinc-900 dark:text-zinc-100">
            Sender Display Name
          </label>
          <input
            type="text"
            disabled={!isOwnerOrAdmin}
            value={senderName}
            onChange={(e) => setSenderName(e.target.value)}
            placeholder="e.g. Acme Corp via Company Brain"
            className="w-full rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#1a1a1d] px-3 py-1.5 text-xs text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:border-blue-500 transition-colors disabled:opacity-50"
          />
          <p className="text-[11px] text-zinc-500">The &apos;From&apos; name visible in recipients&apos; email clients.</p>
        </div>

        {/* Footer Note */}
        <div className="space-y-1.5">
          <label className="block text-xs font-semibold text-zinc-900 dark:text-zinc-100">
            Email Footer Text
          </label>
          <input
            type="text"
            disabled={!isOwnerOrAdmin}
            value={footerText}
            onChange={(e) => setFooterText(e.target.value)}
            placeholder="e.g. Sent from Acme Corp Operations"
            className="w-full rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#1a1a1d] px-3 py-1.5 text-xs text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:border-blue-500 transition-colors disabled:opacity-50"
          />
        </div>

        {/* Brand Accent Color */}
        <div className="space-y-1.5">
          <label className="block text-xs font-semibold text-zinc-900 dark:text-zinc-100">
            Brand Accent Color
          </label>
          <div className="flex items-center gap-3">
            <input
              type="color"
              disabled={!isOwnerOrAdmin}
              value={brandColor}
              onChange={(e) => setBrandColor(e.target.value)}
              className="h-8 w-12 rounded cursor-pointer border border-zinc-200 dark:border-zinc-700 bg-transparent"
            />
            <span className="font-mono text-xs text-zinc-600 dark:text-zinc-400">{brandColor.toUpperCase()}</span>
          </div>
        </div>

        {/* Email Preview Card */}
        <div className="mt-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#18181b] p-4 space-y-2 shadow-2xs">
          <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-2">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: brandColor }} />
              <span className="text-xs font-semibold text-zinc-900 dark:text-white">
                {senderName || activeOrg?.name || "Company Brain"}
              </span>
            </div>
            <span className="text-[10px] text-zinc-400 font-mono">noreply@companybrain.ai</span>
          </div>
          <div className="py-2 text-xs text-zinc-700 dark:text-zinc-300">
            <p className="font-semibold text-zinc-900 dark:text-white">Task assigned to you: Review Q4 Budget</p>
            <p className="text-zinc-500 text-[11px] mt-1">
              You were assigned to an action item in {activeOrg?.name || "your organization"}.
            </p>
          </div>
          <div className="border-t border-zinc-100 dark:border-zinc-800 pt-2 text-[10px] text-zinc-400 text-center">
            {footerText || "Sent via Company Brain"}
          </div>
        </div>

        {!isOwnerOrAdmin && (
          <p className="text-[11px] text-amber-500">
            Only workspace owners or admins can modify branding settings.
          </p>
        )}

        <div className="flex items-center justify-between pt-2">
          {saveStatus && (
            <span
              className={`text-xs ${
                saveStatus.success ? "text-emerald-600 dark:text-emerald-400" : "text-red-500"
              }`}
            >
              {saveStatus.message}
            </span>
          )}
          {isOwnerOrAdmin && (
            <button
              type="submit"
              disabled={isSaving}
              className="ml-auto rounded-lg bg-zinc-900 dark:bg-white px-3 py-1.5 text-xs font-semibold text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-100 transition-colors disabled:opacity-50"
            >
              {isSaving ? "Saving..." : "Save Branding"}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
