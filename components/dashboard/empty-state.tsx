import * as React from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface EmptyStateProps {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  phaseBadge?: string;
  actionText?: string;
  actionHref?: string;
  onAction?: () => void;
  className?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  phaseBadge,
  actionText,
  actionHref,
  onAction,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center rounded-xl border border-border bg-card p-6 text-center transition-all ${
        className || "py-10 px-6"
      }`}
    >
      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-surface-secondary text-secondary-foreground ring-1 ring-border shadow-xs">
        <Icon className="h-5 w-5" />
      </div>
      <div className="mt-3.5 flex items-center gap-2">
        <h3 className="text-sm font-semibold text-foreground tracking-tight">{title}</h3>
        {phaseBadge && <Badge variant="secondary" className="text-[10px] py-0 px-2">{phaseBadge}</Badge>}
      </div>
      <p className="mt-1.5 max-w-sm text-xs leading-relaxed text-muted-foreground">
        {description}
      </p>

      {actionText && (
        <div className="mt-4">
          {actionHref ? (
            <Link href={actionHref}>
              <Button size="sm" variant="secondary" className="text-xs h-8">
                {actionText}
              </Button>
            </Link>
          ) : (
            <Button size="sm" variant="secondary" onClick={onAction} className="text-xs h-8">
              {actionText}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
