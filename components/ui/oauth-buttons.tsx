"use client";

import * as React from "react";
import { initiateOAuthAction } from "@/lib/auth/actions";
import { Button } from "./button";

export function OAuthButtons({ returnUrl }: { returnUrl?: string } = {}) {
  const [isLoading, setIsLoading] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  const handleGitHubOAuth = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const res = await initiateOAuthAction("github", returnUrl);
      if (res.success && res.url) {
        window.location.href = res.url;
      } else {
        setErrorMessage(res.error || "Failed to initiate GitHub authentication.");
        setIsLoading(false);
      }
    } catch (err: any) {
      console.error("Failed to initiate GitHub OAuth:", err);
      setErrorMessage(err?.message || "Failed to initiate GitHub authentication.");
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-2.5">
      {errorMessage && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-2.5 text-xs text-red-400">
          {errorMessage}
        </div>
      )}
      <Button
        type="button"
        variant="secondary"
        onClick={handleGitHubOAuth}
        disabled={isLoading}
        className="w-full gap-2.5 bg-[#19191C] hover:bg-[#222225] text-[#F5F5F5] border border-[#29292D] shadow-sm"
      >
        <svg className="h-4 w-4 fill-current" viewBox="0 0 24 24">
          <path
            fillRule="evenodd"
            clipRule="evenodd"
            d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
          />
        </svg>
        <span>
          {isLoading ? "Connecting to GitHub..." : "Continue with GitHub"}
        </span>
      </Button>
    </div>
  );
}
