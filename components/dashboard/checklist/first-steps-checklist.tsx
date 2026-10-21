"use client";

import * as React from "react";
import Link from "next/link";
import {
  Sparkles,
  CheckCircle2,
  Circle,
  ArrowRight,
  X,
  FileText,
  Users,
  Network,
  Settings,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { updateChecklistAction, dismissChecklistAction } from "@/lib/onboarding/actions";
import { useSettings } from "@/components/dashboard/settings/settings-context";

interface FirstStepsChecklistProps {
  initialState: {
    page_created?: boolean;
    member_invited?: boolean;
    connection_explored?: boolean;
    settings_configured?: boolean;
    dismissed?: boolean;
    [key: string]: boolean | undefined;
  };
  hasPages: boolean;
  hasMultipleMembers: boolean;
  organizationId: string;
}

export function FirstStepsChecklist({
  initialState,
  hasPages,
  hasMultipleMembers,
  organizationId,
}: FirstStepsChecklistProps) {
  const { openSettings } = useSettings();
  const [state, setState] = React.useState(initialState);
  const [isDismissed, setIsDismissed] = React.useState(!!initialState.dismissed);
  const [isCollapsed, setIsCollapsed] = React.useState(false);

  // Auto-sync real database states
  React.useEffect(() => {
    if (hasPages && !state.page_created) {
      setState((prev) => ({ ...prev, page_created: true }));
      updateChecklistAction("page_created", true);
    }
    if (hasMultipleMembers && !state.member_invited) {
      setState((prev) => ({ ...prev, member_invited: true }));
      updateChecklistAction("member_invited", true);
    }
  }, [hasPages, hasMultipleMembers, state.page_created, state.member_invited]);

  if (isDismissed) return null;

  const tasks = [
    {
      key: "page_created",
      title: "Create your first document or decision",
      description: "Document a project wiki, architecture decision (ADR), or team SOP.",
      icon: FileText,
      isCompleted: !!state.page_created || hasPages,
      href: "/dashboard/pages",
      actionText: "New Page",
    },
    {
      key: "member_invited",
      title: "Invite your teammates",
      description: "Collaborate in real time with role-based permissions and tenant isolation.",
      icon: Users,
      isCompleted: !!state.member_invited || hasMultipleMembers,
      href: "/dashboard/people",
      actionText: "Invite Team",
    },
    {
      key: "connection_explored",
      title: "Explore the Company Map",
      description: "View living connections between decisions, projects, and documents.",
      icon: Network,
      isCompleted: !!state.connection_explored,
      href: "/dashboard/connections",
      actionText: "View Map",
      onAction: () => {
        setState((prev) => ({ ...prev, connection_explored: true }));
        updateChecklistAction("connection_explored", true);
      },
    },
    {
      key: "settings_configured",
      title: "Customize workspace branding & settings",
      description: "Upload company logo, set brand color, and review notification settings.",
      icon: Settings,
      isCompleted: !!state.settings_configured,
      actionText: "Open Settings",
      onAction: () => {
        openSettings();
        setState((prev) => ({ ...prev, settings_configured: true }));
        updateChecklistAction("settings_configured", true);
      },
    },
  ];

  const completedCount = tasks.filter((t) => t.isCompleted).length;
  const progressPercent = Math.round((completedCount / tasks.length) * 100);

  const handleToggle = async (key: string, current: boolean) => {
    const nextVal = !current;
    setState((prev) => ({ ...prev, [key]: nextVal }));
    await updateChecklistAction(key, nextVal);
  };

  const handleDismiss = async () => {
    setIsDismissed(true);
    await dismissChecklistAction();
  };

  return (
    <div className="rounded-2xl border border-blue-500/20 bg-gradient-to-b from-[#141418] to-[#0E0E10] p-5 shadow-xl transition-all">
      {/* Top Header */}
      <div className="flex items-center justify-between pb-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-500/15 text-blue-400 border border-blue-500/25">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-[#F5F5F5] tracking-tight">
              Get started with Company Brain
            </h3>
            <p className="text-xs text-[#A1A1AA]">
              {completedCount} of {tasks.length} tasks completed
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-[#71717A] hover:bg-[#1C1C20] hover:text-[#FAFAFA] transition-colors"
            title={isCollapsed ? "Expand checklist" : "Collapse checklist"}
          >
            {isCollapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
          </button>
          <button
            type="button"
            onClick={handleDismiss}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-[#71717A] hover:bg-[#1C1C20] hover:text-[#FAFAFA] transition-colors"
            title="Dismiss checklist"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#1F1F24]">
        <div
          className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-all duration-500 rounded-full"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* Task List */}
      {!isCollapsed && (
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 animate-in fade-in duration-200">
          {tasks.map((task) => {
            const Icon = task.icon;
            return (
              <div
                key={task.key}
                className={`flex items-start justify-between gap-3 rounded-xl border p-3.5 transition-all ${
                  task.isCompleted
                    ? "border-emerald-500/20 bg-emerald-500/5 text-[#A1A1AA]"
                    : "border-[#242428] bg-[#141416]/80 text-[#F5F5F5] hover:border-[#323238]"
                }`}
              >
                <div className="flex items-start gap-3 min-w-0">
                  <button
                    type="button"
                    onClick={() => handleToggle(task.key, task.isCompleted)}
                    className="mt-0.5 text-left transition-colors focus:outline-none"
                    title={task.isCompleted ? "Mark incomplete" : "Mark completed"}
                  >
                    {task.isCompleted ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                    ) : (
                      <Circle className="h-4 w-4 text-[#52525B] hover:text-blue-400" />
                    )}
                  </button>

                  <div className="min-w-0">
                    <p
                      className={`text-xs font-semibold leading-tight ${
                        task.isCompleted ? "line-through text-[#71717A]" : "text-[#F5F5F5]"
                      }`}
                    >
                      {task.title}
                    </p>
                    <p className="mt-1 text-[11px] text-[#71717A] leading-snug">
                      {task.description}
                    </p>
                  </div>
                </div>

                {/* Direct Action Link/Button */}
                {task.href ? (
                  <Link
                    href={task.href}
                    onClick={task.onAction}
                    className="shrink-0 inline-flex items-center gap-1 rounded-lg border border-[#2E2E34] bg-[#1A1A1E] px-2.5 py-1 text-[11px] font-medium text-[#D4D4D8] hover:bg-[#25252A] hover:text-white transition-colors"
                  >
                    <span>{task.actionText}</span>
                    <ArrowRight className="h-3 w-3" />
                  </Link>
                ) : (
                  <button
                    type="button"
                    onClick={task.onAction}
                    className="shrink-0 inline-flex items-center gap-1 rounded-lg border border-[#2E2E34] bg-[#1A1A1E] px-2.5 py-1 text-[11px] font-medium text-[#D4D4D8] hover:bg-[#25252A] hover:text-white transition-colors"
                  >
                    <span>{task.actionText}</span>
                    <ArrowRight className="h-3 w-3" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
