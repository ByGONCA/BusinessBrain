"use client";

import * as React from "react";
import { LogOut, User } from "lucide-react";
import { signOutAction } from "@/lib/auth/actions";

interface UserMenuProps {
  userEmail: string;
  avatarUrl?: string;
  userName?: string;
}

export function UserMenu({ userEmail, avatarUrl, userName }: UserMenuProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [imgError, setImgError] = React.useState(false);
  const [isPending, startTransition] = React.useTransition();
  const menuRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSignOut = () => {
    startTransition(async () => {
      await signOutAction();
    });
  };

  const initial = (userName || userEmail || "U").trim().charAt(0).toUpperCase() || "U";

  // Check if avatarUrl is a valid external URL (not an empty string or data placeholder)
  const hasValidAvatar = Boolean(avatarUrl && (avatarUrl.startsWith("http://") || avatarUrl.startsWith("https://")) && !imgError);

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-secondary text-xs font-bold text-foreground ring-1 ring-border/50 hover:ring-border overflow-hidden transition-all focus:outline-none cursor-pointer shadow-2xs shrink-0 select-none"
        title={userName || userEmail}
        aria-label="User profile options"
      >
        {hasValidAvatar ? (
          <img
            src={avatarUrl}
            alt=""
            onError={() => setImgError(true)}
            className="h-full w-full object-cover rounded-full"
          />
        ) : (
          <span className="flex h-full w-full items-center justify-center rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-bold text-xs uppercase shadow-xs">
            {initial}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full z-50 mt-1.5 w-52 rounded-xl border border-border/70 bg-card p-1.5 shadow-xl backdrop-blur-md animate-in fade-in duration-100">
          <div className="px-2 py-1.5 border-b border-border/40">
            <p className="text-[10px] uppercase font-semibold tracking-wider text-muted-foreground">
              Signed in as
            </p>
            <p className="truncate text-xs font-medium text-foreground mt-0.5">
              {userName || userEmail}
            </p>
            {userName && (
              <p className="truncate text-[11px] text-muted-foreground/80">
                {userEmail}
              </p>
            )}
          </div>

          <div className="pt-1">
            <button
              onClick={handleSignOut}
              disabled={isPending}
              className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-rose-400 hover:bg-rose-500/10 transition-colors disabled:opacity-50 cursor-pointer"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>{isPending ? "Signing out..." : "Sign out"}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
