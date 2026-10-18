"use client";

import * as React from "react";
import { ErrorPanel } from "@/components/ui/error-notice";

interface RootErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function RootError({ error, reset }: RootErrorProps) {
  React.useEffect(() => {
    // Log unexpected runtime error safely without exposing secrets
    console.error("Root Application Error:", {
      message: error?.message,
      digest: error?.digest,
    });
  }, [error]);

  return (
    <main className="relative min-h-screen w-full flex items-center justify-center p-6 bg-[#080607] bg-[radial-gradient(ellipse_80%_80%_at_50%_35%,rgba(90,14,20,0.20)_0%,rgba(8,6,7,0.98)_72%,#080607_100%)] font-sans text-foreground">
      <ErrorPanel
        title="Something went wrong"
        description="A temporary error occurred while processing your request. You can retry the action, refresh the page, or return to the dashboard."
        digest={error?.digest}
        onRetry={reset}
        showRefresh={true}
        showDashboardLink={true}
      />
    </main>
  );
}
