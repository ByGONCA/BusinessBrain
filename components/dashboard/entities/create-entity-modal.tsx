"use client";

import * as React from "react";
import { X, Loader2, Plus } from "lucide-react";
import { createCompanyEntityAction } from "@/lib/entities/actions";
import { CompanyEntityType } from "@/lib/entities/types";

interface CreateEntityModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultType?: CompanyEntityType;
  onCreated?: () => void;
}

const TYPE_CONFIG: Record<
  CompanyEntityType,
  {
    label: string;
    description: string;
    titlePlaceholder: string;
    contentPlaceholder: string;
  }
> = {
  goal: {
    label: "Company Goal",
    description: "Define a high-level strategic target or key outcome.",
    titlePlaceholder: "e.g., Reach €50k MRR by Q4",
    contentPlaceholder: "Context, milestones, and success criteria...",
  },
  decision: {
    label: "Decision (ADR)",
    description: "Record an architectural or business decision with rationale.",
    titlePlaceholder: "e.g., Adopt Turbopack for Edge Runtime",
    contentPlaceholder: "Context, alternatives considered, and decision rationale...",
  },
  task: {
    label: "Task / Action Item",
    description: "Track an actionable item across projects and meetings.",
    titlePlaceholder: "e.g., Finalize Stripe tax configuration",
    contentPlaceholder: "Task description, acceptance criteria, or technical notes...",
  },
  project: {
    label: "Project",
    description: "Organize major business initiatives and cross-functional work.",
    titlePlaceholder: "e.g., Mobile Companion App Q1",
    contentPlaceholder: "Scope, core deliverables, and initial milestones...",
  },
  meeting: {
    label: "Meeting Record",
    description: "Capture minutes, participants, and outcomes.",
    titlePlaceholder: "e.g., Q3 Executive Alignment Sync",
    contentPlaceholder: "Meeting summary, discussed topics, and action points...",
  },
  document: {
    label: "Knowledge Document",
    description: "Reference material, operational guide, or standard policy.",
    titlePlaceholder: "e.g., Incident Management Playbook",
    contentPlaceholder: "Document contents or reference overview...",
  },
  person: {
    label: "Person / Contact",
    description: "Stakeholder, advisor, or customer contact.",
    titlePlaceholder: "e.g., Pedro Santos",
    contentPlaceholder: "Role, contact information, and affiliation notes...",
  },
};

export function CreateEntityModal({
  isOpen,
  onClose,
  defaultType = "goal",
  onCreated,
}: CreateEntityModalProps) {
  const [type, setType] = React.useState<CompanyEntityType>(defaultType);
  const [title, setTitle] = React.useState("");
  const [content, setContent] = React.useState("");
  const [status, setStatus] = React.useState("active");
  const [targetDate, setTargetDate] = React.useState("");
  const [priority, setPriority] = React.useState("medium");
  const [error, setError] = React.useState<string | null>(null);
  const [isPending, startTransition] = React.useTransition();

  React.useEffect(() => {
    if (isOpen) {
      setType(defaultType);
      setTitle("");
      setContent("");
      setStatus("active");
      setTargetDate("");
      setPriority("medium");
      setError(null);
    }
  }, [isOpen, defaultType]);

  // Handle ESC key to close
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const config = TYPE_CONFIG[type] || TYPE_CONFIG.goal;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError("Title is required.");
      return;
    }

    setError(null);
    startTransition(async () => {
      const metadata: Record<string, unknown> = {
        status,
        target_date: targetDate || undefined,
        priority: type === "task" ? priority : undefined,
      };

      const result = await createCompanyEntityAction({
        type,
        title: title.trim(),
        content: content.trim(),
        metadata,
      });

      if (result.success) {
        onClose();
        onCreated?.();
      } else {
        setError(result.error || "Failed to create entity.");
      }
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div
        className="relative w-full max-w-lg rounded-xl border border-border bg-background text-foreground p-6 shadow-2xl text-foreground"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-border">
          <div>
            <h2 id="modal-title" className="text-base font-semibold text-foreground">
              Create {config.label}
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">{config.description}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-hover transition-colors"
            aria-label="Close dialog"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {error && (
          <div className="mt-4 rounded-lg bg-rose-500/10 border border-rose-500/20 p-2.5 text-xs text-rose-400">
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">
              Title <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={config.titlePlaceholder}
              autoFocus
              className="w-full rounded-lg border border-border bg-surface-secondary px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-hidden focus:ring-1 focus:ring-emerald-400"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full rounded-lg border border-border bg-surface-secondary px-3 py-2 text-xs text-foreground focus:outline-hidden focus:ring-1 focus:ring-emerald-400"
              >
                {type === "task" ? (
                  <>
                    <option value="todo">To Do</option>
                    <option value="in_progress">In Progress</option>
                    <option value="completed">Completed</option>
                  </>
                ) : type === "decision" ? (
                  <>
                    <option value="proposed">Proposed</option>
                    <option value="accepted">Accepted</option>
                    <option value="superseded">Superseded</option>
                    <option value="rejected">Rejected</option>
                  </>
                ) : (
                  <>
                    <option value="active">Active</option>
                    <option value="on_track">On Track</option>
                    <option value="at_risk">At Risk</option>
                    <option value="completed">Completed</option>
                  </>
                )}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                {type === "task" ? "Due Date" : "Target Date"}
              </label>
              <input
                type="text"
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
                placeholder="e.g. Q4 2026 or 2026-11-15"
                className="w-full rounded-lg border border-border bg-surface-secondary px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-hidden focus:ring-1 focus:ring-emerald-400"
              />
            </div>
          </div>

          {type === "task" && (
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Priority</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="w-full rounded-lg border border-border bg-surface-secondary px-3 py-2 text-xs text-foreground focus:outline-hidden focus:ring-1 focus:ring-emerald-400"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">
              Description & Notes
            </label>
            <textarea
              rows={3}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={config.contentPlaceholder}
              className="w-full rounded-lg border border-border bg-surface-secondary px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-hidden focus:ring-1 focus:ring-emerald-400 resize-none"
            />
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              className="rounded-lg border border-border bg-surface-secondary px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-hover hover:text-foreground transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending || !title.trim()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-foreground px-3.5 py-1.5 text-xs font-medium transition-colors shadow-sm"
            >
              {isPending ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Plus className="h-3.5 w-3.5" />
                  <span>Save {config.label}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
