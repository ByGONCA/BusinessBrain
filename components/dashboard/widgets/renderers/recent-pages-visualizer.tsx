"use client";

import * as React from "react";
import NextLink from "next/link";
import { Clock } from "lucide-react";
import { PageIcon } from "@/components/dashboard/pages/page-icon";
import { cn } from "@/lib/utils";
import { WidgetInstanceConfig } from "@/lib/widgets/types";
import { useLanguage, en } from "@/lib/i18n";

export interface RecentPageItem {
  id: string;
  title: string;
  icon?: string | null;
  updated_at: string;
}

export interface RecentPagesVisualizerProps {
  widget: WidgetInstanceConfig;
  pages?: RecentPageItem[];
  onRecordVisit?: (item: { id: string; title: string; type: "page"; href: string }) => void;
  onDemoNavigate?: (href: string) => void;
  demoMode?: boolean;
  className?: string;
}

export function RecentPagesVisualizer({
  widget: _widget,
  pages = [],
  onRecordVisit,
  onDemoNavigate,
  demoMode,
  className,
}: RecentPagesVisualizerProps) {
  const { t, locale } = useLanguage();
  const h = t?.homeDashboard || en.homeDashboard;
  const intlLocale =
    locale === "en" ? "en-US" : locale === "pt" ? "pt-PT" : locale === "es" ? "es-ES" : "fr-FR";

  const LinkWrapper = React.useCallback(
    ({ href, className: linkClass, onClick, children }: any) => {
      if (demoMode && onDemoNavigate) {
        return (
          <button
            type="button"
            onClick={() => {
              onClick?.();
              onDemoNavigate(href);
            }}
            className={cn("text-left cursor-pointer", linkClass)}
          >
            {children}
          </button>
        );
      }
      return (
        <NextLink href={href} onClick={onClick} className={linkClass}>
          {children}
        </NextLink>
      );
    },
    [demoMode, onDemoNavigate]
  );

  return (
    <div className={cn("space-y-2 select-none", className)}>
      <div className="flex items-center justify-end pb-1">
        <LinkWrapper
          href="/dashboard/pages"
          className="text-xs text-purple-500 dark:text-purple-400 hover:text-purple-600 dark:hover:text-purple-300 font-medium transition-colors"
        >
          {h.viewAllPages}
        </LinkWrapper>
      </div>

      <div className="divide-y divide-zinc-100 dark:divide-white/[0.04]">
        {pages.length > 0 ? (
          pages.slice(0, 5).map((page) => (
            <LinkWrapper
              key={page.id}
              href={`/dashboard/pages/${page.id}`}
              onClick={() =>
                onRecordVisit?.({
                  id: page.id,
                  title: page.title || h.untitled,
                  type: "page",
                  href: `/dashboard/pages/${page.id}`,
                })
              }
              className="flex items-center justify-between py-2 px-1 hover:bg-zinc-50 dark:hover:bg-white/[0.03] rounded-lg transition-colors group"
            >
              <div className="flex items-center gap-2.5 min-w-0 pr-2">
                <PageIcon icon={page.icon} pageId={page.id} className="text-sm shrink-0" />
                <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300 truncate group-hover:text-zinc-900 dark:group-hover:text-white transition-colors">
                  {page.title || h.untitled}
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-[10px] text-zinc-400 dark:text-zinc-500 shrink-0 font-mono">
                <Clock className="h-3 w-3" />
                <span>{new Date(page.updated_at).toLocaleDateString(intlLocale)}</span>
              </div>
            </LinkWrapper>
          ))
        ) : (
          <div className="py-6 text-center text-xs text-zinc-400 dark:text-zinc-500">
            <p>{h.noPagesYet}</p>
            <LinkWrapper
              href="/dashboard/pages"
              className="inline-block mt-2 text-xs font-semibold text-purple-500 dark:text-purple-400 hover:underline"
            >
              {h.createFirstDocument}
            </LinkWrapper>
          </div>
        )}
      </div>
    </div>
  );
}
