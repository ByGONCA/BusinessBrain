"use client";

import * as React from "react";
import { Check, Loader2, Settings2 } from "lucide-react";
import { OrganizationWithRole } from "@/lib/organizations/types";
import { updateWorkspaceDefaultsAction } from "@/lib/settings/actions";

interface WorkspaceDefaultsTabProps {
  activeOrg: OrganizationWithRole | null;
}

export function WorkspaceDefaultsTab({ activeOrg }: WorkspaceDefaultsTabProps) {
  const isOwnerOrAdmin = activeOrg?.role === "owner" || activeOrg?.role === "admin";

  const [defaults, setDefaults] = React.useState({
    defaultTaskStatus: "todo",
    defaultTaskPriority: "medium",
    defaultProjectStatus: "active",
    defaultMeetingDuration: 30,
    defaultCalendarBehavior: "prompt",
    defaultPageIcon: "document",
    defaultPageLayout: "standard",
    defaultCurrency: activeOrg?.default_currency || "EUR",
    defaultTimezone: activeOrg?.default_timezone || "Europe/Lisbon",
  });

  const [isSaving, setIsSaving] = React.useState(false);
  const [statusMessage, setStatusMessage] = React.useState<{ success?: boolean; message?: string } | null>(null);

  React.useEffect(() => {
    if (activeOrg?.workspace_defaults) {
      setDefaults((prev) => ({
        ...prev,
        ...(activeOrg.workspace_defaults as Record<string, unknown>),
        defaultCurrency: activeOrg.default_currency || prev.defaultCurrency,
        defaultTimezone: activeOrg.default_timezone || prev.defaultTimezone,
      }));
    }
  }, [activeOrg]);

  const handleChange = (key: string, value: unknown) => {
    setDefaults((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeOrg?.id) return;
    setIsSaving(true);
    setStatusMessage(null);
    try {
      const res = await updateWorkspaceDefaultsAction(activeOrg.id, defaults);
      if (res.success) {
        setStatusMessage({ success: true, message: "Workspace defaults saved successfully." });
        setTimeout(() => setStatusMessage(null), 3000);
      } else {
        setStatusMessage({ success: false, message: res.error || "Failed to update defaults." });
      }
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-xl">
      <div>
        <h2 className="text-lg font-bold text-zinc-900 dark:text-white tracking-tight">Workspace Defaults</h2>
        <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-0.5">
          Establish organization-wide presets for task creation, project statuses, calendar syncing, and newly authored pages.
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-5">
        {/* Task & Project Defaults */}
        <div className="space-y-3">
          <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Tasks & Projects
          </span>

          {/* Default Task Status */}
          <div className="flex items-center justify-between py-2 border-b border-zinc-200 dark:border-zinc-800">
            <div>
              <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">Default Task Status</p>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">Applied when quickly capturing new tasks</p>
            </div>
            <select
              disabled={!isOwnerOrAdmin}
              value={defaults.defaultTaskStatus}
              onChange={(e) => handleChange("defaultTaskStatus", e.target.value)}
              className="rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-[#1a1a1d] px-3 py-1.5 text-xs font-medium text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-blue-500 disabled:opacity-50 cursor-pointer shadow-xs"
            >
              <option value="todo">To Do</option>
              <option value="in_progress">In Progress</option>
              <option value="backlog">Backlog</option>
            </select>
          </div>

          {/* Default Task Priority */}
          <div className="flex items-center justify-between py-2 border-b border-zinc-200 dark:border-zinc-800">
            <div>
              <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">Default Task Priority</p>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">Standard priority rating</p>
            </div>
            <select
              disabled={!isOwnerOrAdmin}
              value={defaults.defaultTaskPriority}
              onChange={(e) => handleChange("defaultTaskPriority", e.target.value)}
              className="rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-[#1a1a1d] px-3 py-1.5 text-xs font-medium text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-blue-500 disabled:opacity-50 cursor-pointer shadow-xs"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>

          {/* Default Project Status */}
          <div className="flex items-center justify-between py-2 border-b border-zinc-200 dark:border-zinc-800">
            <div>
              <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">Default Project Status</p>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">Lifecycle state for new initiatives</p>
            </div>
            <select
              disabled={!isOwnerOrAdmin}
              value={defaults.defaultProjectStatus}
              onChange={(e) => handleChange("defaultProjectStatus", e.target.value)}
              className="rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-[#1a1a1d] px-3 py-1.5 text-xs font-medium text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-blue-500 disabled:opacity-50 cursor-pointer shadow-xs"
            >
              <option value="planning">Planning</option>
              <option value="active">Active</option>
              <option value="on_hold">On Hold</option>
            </select>
          </div>
        </div>

        {/* Calendar & Meetings */}
        <div className="space-y-3 pt-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Calendar & Meetings
          </span>

          {/* Meeting Duration */}
          <div className="flex items-center justify-between py-2 border-b border-zinc-200 dark:border-zinc-800">
            <div>
              <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">Default Meeting Duration</p>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">Default time block when creating calendar events</p>
            </div>
            <select
              disabled={!isOwnerOrAdmin}
              value={defaults.defaultMeetingDuration}
              onChange={(e) => handleChange("defaultMeetingDuration", Number(e.target.value))}
              className="rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-[#1a1a1d] px-3 py-1.5 text-xs font-medium text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-blue-500 disabled:opacity-50 cursor-pointer shadow-xs"
            >
              <option value={15}>15 minutes</option>
              <option value={30}>30 minutes</option>
              <option value={45}>45 minutes</option>
              <option value={60}>60 minutes</option>
            </select>
          </div>

          {/* Calendar Sync Behavior */}
          <div className="flex items-center justify-between py-2 border-b border-zinc-200 dark:border-zinc-800">
            <div>
              <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">Meeting Creation Behavior</p>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">External provider synchronization mode</p>
            </div>
            <select
              disabled={!isOwnerOrAdmin}
              value={defaults.defaultCalendarBehavior}
              onChange={(e) => handleChange("defaultCalendarBehavior", e.target.value)}
              className="rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-[#1a1a1d] px-3 py-1.5 text-xs font-medium text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-blue-500 disabled:opacity-50 cursor-pointer shadow-xs"
            >
              <option value="prompt">Prompt for Google Calendar sync</option>
              <option value="always_create">Always sync to primary calendar</option>
              <option value="internal_only">Company Brain internal only</option>
            </select>
          </div>
        </div>

        {/* Financial & Regional Defaults */}
        <div className="space-y-3 pt-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Workspace Currency
          </span>

          <div className="flex items-center justify-between py-2 border-b border-zinc-200 dark:border-zinc-800">
            <div>
              <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">Default Currency</p>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">Reporting and budget figures</p>
            </div>
            <select
              disabled={!isOwnerOrAdmin}
              value={defaults.defaultCurrency}
              onChange={(e) => handleChange("defaultCurrency", e.target.value)}
              className="rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-[#1a1a1d] px-3 py-1.5 text-xs font-medium text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-blue-500 disabled:opacity-50 cursor-pointer shadow-xs"
            >
              <option value="EUR">EUR (€)</option>
              <option value="USD">USD ($)</option>
              <option value="GBP">GBP (£)</option>
            </select>
          </div>
        </div>

        {/* Submit */}
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
                <span>Save Defaults</span>
              )}
            </button>
          </div>
        )}
      </form>
    </div>
  );
}
