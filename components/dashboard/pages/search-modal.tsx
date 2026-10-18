"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Search, FileText, Loader2, X, ArrowRight } from "lucide-react";
import { PageRecord } from "@/lib/pages/types";
import { searchPagesAction } from "@/lib/pages/actions";
import { PageIcon } from "./page-icon";
import { cn } from "@/lib/utils";

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  organizationId: string;
}

export function SearchModal({ isOpen, onClose, organizationId }: SearchModalProps) {
  const router = useRouter();
  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<PageRecord[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [selectedIndex, setSelectedIndex] = React.useState(0);
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setQuery("");
      setResults([]);
      setSelectedIndex(0);
    }
  }, [isOpen]);

  React.useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setLoading(false);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await searchPagesAction(query);
        setResults(res);
        setSelectedIndex(0);
      } catch (e) {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [query, organizationId]);

  const handleSelect = (pageId: string) => {
    onClose();
    router.push(`/dashboard/pages/${pageId}`);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % (results.length || 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + results.length) % (results.length || 1));
    } else if (e.key === "Enter" && results[selectedIndex]) {
      e.preventDefault();
      handleSelect(results[selectedIndex].id);
    } else if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-100">
      <div className="w-full max-w-xl rounded-2xl border border-[#242427] bg-[#141415] shadow-2xl overflow-hidden flex flex-col">
        {/* Search Input Bar */}
        <div className="flex items-center gap-2.5 px-4 py-3 border-b border-[#1C1C1F]">
          <Search className="h-4 w-4 text-[#71717A] shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search pages by title or content..."
            className="flex-1 bg-transparent text-sm text-[#F5F5F5] placeholder:text-[#71717A] outline-none"
          />
          {loading && <Loader2 className="h-4 w-4 animate-spin text-blue-400 shrink-0" />}
          <button
            type="button"
            onClick={onClose}
            className="text-[#71717A] hover:text-[#F5F5F5] transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Results Stream */}
        <div className="max-h-80 overflow-y-auto p-2 space-y-1 no-scrollbar">
          {query.trim() && !loading && results.length === 0 && (
            <div className="py-8 text-center text-xs text-[#71717A]">
              No pages match &ldquo;{query}&rdquo;
            </div>
          )}

          {!query.trim() && (
            <div className="py-8 text-center text-xs text-[#71717A]">
              Type to search page titles and notes...
            </div>
          )}

          {results.map((page, idx) => {
            const isSelected = idx === selectedIndex;
            return (
              <button
                key={page.id}
                type="button"
                onClick={() => handleSelect(page.id)}
                onMouseEnter={() => setSelectedIndex(idx)}
                className={cn(
                  "flex w-full items-center justify-between rounded-xl px-3 py-2 text-left transition-colors",
                  isSelected
                    ? "bg-[#242427] text-[#F5F5F5]"
                    : "text-[#A1A1AA] hover:bg-[#1C1C1F] hover:text-[#F5F5F5]"
                )}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <PageIcon
                    icon={page.icon}
                    pageId={page.id}
                    iconFileId={(page as unknown as { icon_file_id?: string | null }).icon_file_id}
                    className="text-base"
                    imgClassName="h-5 w-5 rounded object-cover"
                  />
                  <div className="min-w-0">
                    <div className="text-xs font-medium truncate">{page.title || "Untitled"}</div>
                    {page.content_text && (
                      <div className="text-[10px] text-[#71717A] truncate max-w-sm mt-0.5">
                        {page.content_text}
                      </div>
                    )}
                  </div>
                </div>
                <ArrowRight className="h-3.5 w-3.5 text-[#71717A] opacity-60 shrink-0 ml-2" />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
