"use client";

// ==============================================================================
// Company Brain: Link Preview Popover
// Interactive floating popover when clicking or focusing links in the editor.
// Provides 1-click open, copy, edit, and unlink actions.
// ==============================================================================

import * as React from "react";
import {
  ExternalLink,
  Copy,
  Check,
  Pencil,
  Unlink,
  Globe,
} from "lucide-react";

interface LinkPreviewPopoverProps {
  anchorEl: HTMLAnchorElement | null;
  onClose: () => void;
  onEdit: (anchor: HTMLAnchorElement) => void;
  onUnlink: (anchor: HTMLAnchorElement) => void;
}

export function LinkPreviewPopover({
  anchorEl,
  onClose,
  onEdit,
  onUnlink,
}: LinkPreviewPopoverProps) {
  const [copied, setCopied] = React.useState(false);
  const popoverRef = React.useRef<HTMLDivElement>(null);

  if (!anchorEl) return null;

  const url = anchorEl.getAttribute("href") || "";
  const rect = anchorEl.getBoundingClientRect();

  // Position popover below the anchor, or above if near viewport bottom
  const spaceBelow = window.innerHeight - rect.bottom;
  const showAbove = spaceBelow < 120 && rect.top > 120;
  const top = showAbove ? Math.max(10, rect.top - 46) : rect.bottom + 6;
  const left = Math.max(12, Math.min(window.innerWidth - 360, rect.left));

  const handleCopy = async () => {
    if (!url) return;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleOpen = () => {
    if (url) {
      window.open(url, "_blank", "noopener,noreferrer");
      onClose();
    }
  };

  // Close when clicking outside
  React.useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node) &&
        !anchorEl?.contains(e.target as Node)
      ) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [anchorEl, onClose]);

  // Close on Escape
  React.useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div
      ref={popoverRef}
      style={{ top: `${top}px`, left: `${left}px` }}
      className="fixed z-50 flex items-center gap-1.5 p-1.5 rounded-xl border border-zinc-200/90 dark:border-zinc-800/90 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md shadow-xl text-xs select-none animate-in fade-in zoom-in-95 duration-100"
    >
      {/* Clickable URL */}
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        className="flex items-center gap-1.5 max-w-[180px] sm:max-w-[240px] truncate text-blue-600 dark:text-blue-400 hover:underline px-2 py-1 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-950/40 font-medium transition-colors"
        title={url}
      >
        <Globe className="h-3.5 w-3.5 shrink-0 text-blue-500" />
        <span className="truncate">{url}</span>
      </a>

      <div className="h-4 w-px bg-zinc-200 dark:bg-zinc-800 mx-0.5" />

      {/* Prominent Open Button */}
      <button
        type="button"
        onClick={handleOpen}
        className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs shadow-xs transition-colors shrink-0"
      >
        <ExternalLink className="h-3 w-3" />
        <span>Abrir link</span>
      </button>

      {/* Copy Button */}
      <button
        type="button"
        onClick={handleCopy}
        className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors shrink-0"
        title="Copiar link"
      >
        {copied ? (
          <Check className="h-3.5 w-3.5 text-emerald-500" />
        ) : (
          <Copy className="h-3.5 w-3.5" />
        )}
      </button>

      {/* Edit Button */}
      <button
        type="button"
        onClick={() => {
          onEdit(anchorEl);
          onClose();
        }}
        className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors shrink-0"
        title="Editar link"
      >
        <Pencil className="h-3.5 w-3.5" />
      </button>

      {/* Unlink Button */}
      <button
        type="button"
        onClick={() => {
          onUnlink(anchorEl);
          onClose();
        }}
        className="p-1.5 rounded-lg text-zinc-500 hover:text-red-600 dark:text-zinc-400 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors shrink-0"
        title="Remover link"
      >
        <Unlink className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
