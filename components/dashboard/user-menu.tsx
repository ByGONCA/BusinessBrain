"use client";

import * as React from "react";
import { LogOut, User } from "lucide-react";
import { signOutAction } from "@/lib/auth/actions";

interface UserMenuProps {
  userEmail: string;
}

export function UserMenu({ userEmail }: UserMenuProps) {
  const [isOpen, setIsOpen] = React.useState(false);
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

  const initial = userEmail ? userEmail.charAt(0).toUpperCase() : "U";

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-800 text-xs font-semibold text-slate-200 ring-1 ring-slate-700 hover:ring-slate-600 transition-all focus:outline-none"
      >
        {initial}
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full z-50 mt-1.5 w-52 rounded-xl border border-slate-800 bg-slate-900 p-1.5 shadow-xl backdrop-blur-md">
          <div className="px-2 py-1.5 border-b border-slate-800">
            <p className="text-[10px] uppercase font-semibold tracking-wider text-slate-500">
              Signed in as
            </p>
            <p className="truncate text-xs font-medium text-slate-200 mt-0.5">
              {userEmail}
            </p>
          </div>

          <div className="pt-1">
            <button
              onClick={handleSignOut}
              disabled={isPending}
              className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50"
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
