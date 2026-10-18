"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { Loader2, AlertCircle } from "lucide-react";
import { useSidePeek } from "./side-peek-context";
import { getPageAction, getPageBreadcrumbsAction } from "@/lib/pages/actions";
import { PageRecord, PageBreadcrumbItem } from "@/lib/pages/types";
import { PageBreadcrumbs } from "./page-breadcrumbs";

const BlockEditor = dynamic(
  () => import("./block-editor").then((mod) => mod.BlockEditor),
  {
    loading: () => (
      <div className="flex flex-col items-center justify-center h-64 gap-2 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
        <span className="text-xs">Loading editor...</span>
      </div>
    ),
    ssr: false,
  }
);

export function SidePeekPanel() {
  const router = useRouter();
  const { sidePeekPageId, closeSidePeek } = useSidePeek();
  const [page, setPage] = React.useState<PageRecord | null>(null);
  const [breadcrumbs, setBreadcrumbs] = React.useState<PageBreadcrumbItem[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!sidePeekPageId) {
      setPage(null);
      setBreadcrumbs([]);
      setError(null);
      return;
    }

    let isMounted = true;
    setLoading(true);
    setError(null);

    Promise.all([
      getPageAction(sidePeekPageId),
      getPageBreadcrumbsAction(sidePeekPageId),
    ])
      .then(([pageRes, breadcrumbsRes]) => {
        if (!isMounted) return;

        if (pageRes.success && pageRes.page) {
          setPage(pageRes.page);
        } else {
          setError(pageRes.error || "Could not load page");
        }

        if (breadcrumbsRes.success && breadcrumbsRes.breadcrumbs) {
          setBreadcrumbs(breadcrumbsRes.breadcrumbs);
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        setError(err instanceof Error ? err.message : "Failed to load page");
      })
      .finally(() => {
        if (isMounted) {
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [sidePeekPageId]);

  if (!sidePeekPageId) return null;

  const currentCrumbs =
    breadcrumbs.length > 0
      ? breadcrumbs
      : page
      ? [{ id: page.id, title: page.title, icon: page.icon }]
      : [];

  return (
    <div className="relative h-full w-full flex flex-col bg-background min-w-0 overflow-hidden select-none animate-in fade-in duration-150">
      {/* VS Code-Style Top Breadcrumbs Bar (Matching Left Pane) */}
      <PageBreadcrumbs
        breadcrumbs={currentCrumbs}
        isFavorite={page?.is_favorite}
        onClose={closeSidePeek}
        className="sticky top-0 z-30"
      />

      {/* Main Canvas Area */}
      <div className="flex-1 overflow-y-auto no-scrollbar p-6 md:p-8 select-text min-w-0">
        <div className="mx-auto w-full max-w-4xl">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-64 gap-2 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
              <span className="text-xs">Loading page...</span>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center h-64 gap-3 text-center px-4">
              <AlertCircle className="h-8 w-8 text-red-500" />
              <div className="text-sm font-medium text-foreground">{error}</div>
              <button
                type="button"
                onClick={closeSidePeek}
                className="px-3 py-1.5 rounded-lg border border-border text-xs hover:bg-muted font-medium"
              >
                Close
              </button>
            </div>
          ) : page ? (
            <BlockEditor page={page} />
          ) : null}
        </div>
      </div>
    </div>
  );
}
