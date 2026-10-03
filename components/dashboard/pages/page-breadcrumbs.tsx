"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronRight, FileText } from "lucide-react";
import { PageBreadcrumbItem } from "@/lib/pages/types";
import { PageIcon } from "./page-icon";

interface PageBreadcrumbsProps {
  breadcrumbs: PageBreadcrumbItem[];
}

export function PageBreadcrumbs({ breadcrumbs }: PageBreadcrumbsProps) {
  if (breadcrumbs.length <= 1) return null;

  return (
    <nav className="flex items-center gap-1.5 text-xs text-zinc-500 mb-4 select-none overflow-x-auto no-scrollbar py-1">
      {breadcrumbs.map((crumb, idx) => {
        const isLast = idx === breadcrumbs.length - 1;

        return (
          <React.Fragment key={crumb.id}>
            {idx > 0 && <ChevronRight className="h-3 w-3 shrink-0 text-zinc-400" />}
            {isLast ? (
              <span className="flex items-center gap-1.5 font-medium text-zinc-800 dark:text-zinc-200 truncate max-w-[200px]">
                <PageIcon icon={crumb.icon} className="h-3.5 w-3.5 text-xs" imgClassName="h-3.5 w-3.5 rounded object-cover" />
                <span>{crumb.title || "Untitled"}</span>
              </span>
            ) : (
              <Link
                href={`/dashboard/pages/${crumb.id}`}
                className="flex items-center gap-1.5 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors truncate max-w-[150px]"
              >
                <PageIcon icon={crumb.icon} className="h-3.5 w-3.5 text-xs" imgClassName="h-3.5 w-3.5 rounded object-cover" />
                <span>{crumb.title || "Untitled"}</span>
              </Link>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
}
