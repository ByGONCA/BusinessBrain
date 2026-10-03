import * as React from "react";
import { LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  phaseBadge?: string;
  actionText?: string;
  onAction?: () => void;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  phaseBadge,
}: EmptyStateProps) {
  return (
    <div className="flex min-h-[380px] flex-col items-center justify-center rounded-xl border border-dashed border-slate-800 bg-slate-900/20 p-8 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-800/80 text-slate-300 ring-1 ring-slate-700/50">
        <Icon className="h-6 w-6" />
      </div>
      <div className="mt-4 flex items-center gap-2">
        <h3 className="text-base font-semibold text-slate-100">{title}</h3>
        {phaseBadge && <Badge variant="secondary">{phaseBadge}</Badge>}
      </div>
      <p className="mt-1.5 max-w-sm text-xs leading-relaxed text-slate-400">
        {description}
      </p>
    </div>
  );
}
