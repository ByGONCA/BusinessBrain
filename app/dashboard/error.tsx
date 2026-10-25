"use client";

import * as React from "react";
import { ErrorPanel } from "@/components/ui/error-notice";

interface DashboardErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function DashboardError({ error, reset }: DashboardErrorProps) {
  React.useEffect(() => {
    console.error("Dashboard Canvas Error:", {
      message: error?.message,
      digest: error?.digest,
    });
  }, [error]);

  return (
    <div className="flex flex-1 items-center justify-center p-6 sm:p-10 min-h-[60vh]">
      <ErrorPanel
        title="Unable to load this view"
        description={error?.message || "A temporary interruption occurred while loading this dashboard view. You can reload safely without losing your workspace state."}
        digest={error?.digest}
        onRetry={reset}
        showRefresh={true}
        showDashboardLink={false}
      />
    </div>
  );
}
