"use client";

import * as React from "react";
import { Smile, Upload, X, Search, Image as ImageIcon, Trash2, Link as LinkIcon, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { EMOJI_CATEGORIES, searchAllEmojis } from "./emoji-data";
import { PageIcon } from "./page-icon";

interface EmojiPickerProps {
  currentEmoji: string;
  onSelectEmoji: (emoji: string) => void;
  className?: string;
  triggerClassName?: string;
  pageId?: string | null;
  iconFileId?: string | null;
}

type TabType = "emojis" | "upload";

export function EmojiPicker({
  currentEmoji,
  onSelectEmoji,
  className,
  triggerClassName,
  pageId,
  iconFileId,
}: EmojiPickerProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState<TabType>("emojis");
  const [search, setSearch] = React.useState("");
  const [selectedCategory, setSelectedCategory] = React.useState<string | null>(null);
  const [customUrl, setCustomUrl] = React.useState("");
  const [isProcessing, setIsProcessing] = React.useState(false);
  const [isDragOver, setIsDragOver] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  const popoverRef = React.useRef<HTMLDivElement>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Close popover when clicking outside
  React.useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  // Reset state when popover opens
  React.useEffect(() => {
    if (isOpen) {
      setSearch("");
      setErrorMsg(null);
      // If current icon is an image, default to upload tab
      if (
        currentEmoji?.startsWith("data:image/") ||
        currentEmoji?.startsWith("http://") ||
        currentEmoji?.startsWith("https://")
      ) {
        setActiveTab("upload");
      } else {
        setActiveTab("emojis");
      }
    }
  }, [isOpen, currentEmoji]);

  // Filter emojis based on search or category
  const filteredEmojis = React.useMemo(() => {
    if (search.trim()) {
      return searchAllEmojis(search);
    }
    return null;
  }, [search]);

  // Client-side image resize & compression via HTML5 canvas
  const processImageFile = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      setErrorMsg("Please select a valid image file (PNG, JPG, SVG, WebP)");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setErrorMsg("Image size exceeds 5MB limit");
      return;
    }

    setIsProcessing(true);
    setErrorMsg(null);

    try {
      if (pageId) {
        const formData = new FormData();
        formData.append("file", file);
        const res = await fetch(`/api/pages/${pageId}/icon`, {
          method: "POST",
          body: formData,
        });
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || "Failed to upload image");
        }
        const data = await res.json();
        if (data.iconUrl) {
          onSelectEmoji(data.iconUrl);
          setIsOpen(false);
          return;
        }
      }

      const dataUri = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          const img = new Image();
          img.onload = () => {
            const canvas = document.createElement("canvas");
            const maxSize = 180;
            let width = img.width;
            let height = img.height;

            if (width > height) {
              if (width > maxSize) {
                height = Math.round((height * maxSize) / width);
                width = maxSize;
              }
            } else {
              if (height > maxSize) {
                width = Math.round((width * maxSize) / height);
                height = maxSize;
              }
            }

            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext("2d");
            if (!ctx) {
              resolve(e.target?.result as string);
              return;
            }

            ctx.drawImage(img, 0, 0, width, height);
            const compressed = canvas.toDataURL("image/webp", 0.9);
            resolve(compressed);
          };
          img.onerror = () => reject(new Error("Failed to load image"));
          img.src = e.target?.result as string;
        };
        reader.onerror = () => reject(new Error("Failed to read file"));
        reader.readAsDataURL(file);
      });

      onSelectEmoji(dataUri);
      setIsOpen(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to process image. Please try another file.";
      setErrorMsg(msg);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processImageFile(file);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processImageFile(file);
    }
  };

  const handleApplyUrl = () => {
    const trimmed = customUrl.trim();
    if (!trimmed) return;
    if (!trimmed.startsWith("http://") && !trimmed.startsWith("https://")) {
      setErrorMsg("URL must start with http:// or https://");
      return;
    }
    onSelectEmoji(trimmed);
    setCustomUrl("");
    setIsOpen(false);
  };

  const handleRemoveIcon = () => {
    onSelectEmoji("📄");
    setIsOpen(false);
  };

  const isCustomImage =
    currentEmoji?.startsWith("data:image/") ||
    currentEmoji?.startsWith("http://") ||
    currentEmoji?.startsWith("https://") ||
    currentEmoji?.startsWith("/api/pages/") ||
    currentEmoji === "custom_id" ||
    currentEmoji?.startsWith("custom_id:") ||
    Boolean(iconFileId);

  return (
    <div className={cn("relative inline-block", className)} ref={popoverRef}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex h-9 w-9 items-center justify-center rounded-lg hover:bg-muted/80 transition-colors text-2xl select-none focus:outline-none focus:ring-2 focus:ring-blue-500/20",
          triggerClassName
        )}
        title="Change page icon"
      >
        <PageIcon
          icon={currentEmoji}
          pageId={pageId}
          iconFileId={iconFileId}
          className="text-inherit"
          imgClassName="w-full h-full p-1 rounded-lg object-cover"
        />
      </button>

      {/* Popover */}
      {isOpen && (
        <div className="absolute left-0 top-full mt-2 w-[350px] sm:w-[370px] rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3 shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-100 select-none">
          {/* Header & Tabs */}
          <div className="flex items-center justify-between pb-2 border-b border-zinc-100 dark:border-zinc-800 mb-2.5">
            <div className="flex items-center gap-1 bg-zinc-100 dark:bg-zinc-800/80 p-0.5 rounded-lg text-xs">
              <button
                type="button"
                onClick={() => setActiveTab("emojis")}
                className={cn(
                  "flex items-center gap-1.5 px-2.5 py-1 rounded-md font-medium transition-colors",
                  activeTab === "emojis"
                    ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-2xs"
                    : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
                )}
              >
                <Smile className="h-3.5 w-3.5" />
                <span>Emojis</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("upload")}
                className={cn(
                  "flex items-center gap-1.5 px-2.5 py-1 rounded-md font-medium transition-colors",
                  activeTab === "upload"
                    ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-2xs"
                    : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
                )}
              >
                <Upload className="h-3.5 w-3.5" />
                <span>Custom Image</span>
              </button>
            </div>

            <div className="flex items-center gap-1">
              {currentEmoji && currentEmoji !== "📄" && (
                <button
                  type="button"
                  onClick={handleRemoveIcon}
                  className="flex h-6 w-6 items-center justify-center rounded-md text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                  title="Remove custom icon"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="flex h-6 w-6 items-center justify-center rounded-md text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* TAB 1: EMOJIS */}
          {activeTab === "emojis" && (
            <div className="space-y-2.5">
              {/* Search input */}
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-zinc-400 pointer-events-none" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search all emojis..."
                  className="w-full pl-8 pr-7 py-1.5 text-xs rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all"
                  autoFocus
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch("")}
                    className="absolute right-2 top-2 text-zinc-400 hover:text-zinc-600"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              {/* Category Quick Selector (when not searching) */}
              {!search && (
                <div className="flex items-center gap-1 overflow-x-auto no-scrollbar pb-1 border-b border-zinc-100 dark:border-zinc-800/80">
                  <button
                    type="button"
                    onClick={() => setSelectedCategory(null)}
                    className={cn(
                      "px-2 py-0.5 rounded text-[11px] font-medium transition-colors shrink-0",
                      selectedCategory === null
                        ? "bg-zinc-200 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                        : "text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300"
                    )}
                  >
                    All
                  </button>
                  {EMOJI_CATEGORIES.map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setSelectedCategory(selectedCategory === cat.id ? null : cat.id)}
                      className={cn(
                        "flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] transition-colors shrink-0",
                        selectedCategory === cat.id
                          ? "bg-zinc-200 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                          : "text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300"
                      )}
                      title={cat.name}
                    >
                      <span>{cat.icon}</span>
                    </button>
                  ))}
                </div>
              )}

              {/* Emoji Grid Container */}
              <div className="max-h-72 overflow-y-auto no-scrollbar space-y-3 pr-1">
                {/* Search Results */}
                {filteredEmojis !== null ? (
                  <div>
                    <div className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider px-1 mb-1.5">
                      {filteredEmojis.length} {filteredEmojis.length === 1 ? "Result" : "Results"}
                    </div>
                    {filteredEmojis.length === 0 ? (
                      <div className="py-8 text-center text-xs text-zinc-400">
                        No emojis found for &quot;{search}&quot;
                      </div>
                    ) : (
                      <div className="grid grid-cols-8 gap-1">
                        {filteredEmojis.map((item, idx) => (
                          <button
                            key={`search-${item.emoji}-${idx}`}
                            type="button"
                            onClick={() => {
                              onSelectEmoji(item.emoji);
                              setIsOpen(false);
                            }}
                            className={cn(
                              "h-8 w-8 rounded-lg flex items-center justify-center text-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-transform hover:scale-115 active:scale-95",
                              currentEmoji === item.emoji && "bg-blue-50 dark:bg-blue-900/30 ring-1 ring-blue-500"
                            )}
                            title={item.name}
                          >
                            {item.emoji}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  /* Categorized Emojis */
                  EMOJI_CATEGORIES.filter((cat) =>
                    selectedCategory ? cat.id === selectedCategory : true
                  ).map((cat) => (
                    <div key={cat.id} className="space-y-1">
                      <div className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider px-1 flex items-center gap-1.5">
                        <span>{cat.icon}</span>
                        <span>{cat.name}</span>
                      </div>
                      <div className="grid grid-cols-8 gap-1">
                        {cat.emojis.map((item, itemIdx) => (
                          <button
                            key={`${cat.id}-${item.emoji}-${itemIdx}`}
                            type="button"
                            onClick={() => {
                              onSelectEmoji(item.emoji);
                              setIsOpen(false);
                            }}
                            className={cn(
                              "h-8 w-8 rounded-lg flex items-center justify-center text-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-transform hover:scale-115 active:scale-95",
                              currentEmoji === item.emoji && "bg-blue-50 dark:bg-blue-900/30 ring-1 ring-blue-500"
                            )}
                            title={item.name}
                          >
                            {item.emoji}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* TAB 2: CUSTOM IMAGE UPLOAD */}
          {activeTab === "upload" && (
            <div className="space-y-3 py-1">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />

              {/* Drag and drop upload box */}
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragOver(true);
                }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={cn(
                  "flex flex-col items-center justify-center gap-2 p-5 rounded-xl border-2 border-dashed cursor-pointer transition-all duration-150 text-center",
                  isDragOver
                    ? "border-blue-500 bg-blue-50/50 dark:bg-blue-950/20"
                    : "border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-800/20"
                )}
              >
                {isProcessing ? (
                  <div className="flex flex-col items-center gap-2 py-2">
                    <Loader2 className="h-6 w-6 text-blue-500 animate-spin" />
                    <span className="text-xs text-zinc-500">Processing image...</span>
                  </div>
                ) : (
                  <>
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
                      <ImageIcon className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                        Choose an image or drag it here
                      </div>
                      <div className="text-[11px] text-zinc-400 mt-0.5">
                        PNG, JPG, SVG, WebP up to 5MB
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Current Image Preview if set */}
              {isCustomImage && (
                <div className="flex items-center justify-between p-2 rounded-lg bg-zinc-100 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-800">
                  <div className="flex items-center gap-2 min-w-0">
                    <PageIcon
                      icon={currentEmoji}
                      pageId={pageId}
                      iconFileId={iconFileId}
                      className="h-8 w-8 shrink-0 text-xl"
                      imgClassName="h-8 w-8 rounded-md object-cover border border-zinc-200 dark:border-zinc-700 shrink-0"
                    />
                    <div className="text-xs truncate">
                      <div className="font-medium text-zinc-800 dark:text-zinc-200">Current Icon</div>
                      <div className="text-[10px] text-zinc-400 truncate">Custom uploaded image</div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleRemoveIcon}
                    className="text-xs text-red-500 hover:underline px-1 py-0.5"
                  >
                    Remove
                  </button>
                </div>
              )}

              {/* Image URL Input */}
              <div className="pt-1 border-t border-zinc-100 dark:border-zinc-800">
                <label className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider block mb-1.5">
                  Or paste image link
                </label>
                <div className="flex items-center gap-1.5">
                  <div className="relative flex-1">
                    <LinkIcon className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-zinc-400 pointer-events-none" />
                    <input
                      type="url"
                      value={customUrl}
                      onChange={(e) => {
                        setCustomUrl(e.target.value);
                        setErrorMsg(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleApplyUrl();
                        }
                      }}
                      placeholder="https://example.com/logo.png"
                      className="w-full pl-8 pr-2.5 py-1.5 text-xs rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleApplyUrl}
                    disabled={!customUrl.trim()}
                    className="px-3 py-1.5 rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-xs font-medium hover:bg-zinc-800 dark:hover:bg-white disabled:opacity-40 transition-colors"
                  >
                    Apply
                  </button>
                </div>
              </div>

              {/* Error message */}
              {errorMsg && (
                <div className="text-xs text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-950/20 p-2 rounded-lg">
                  {errorMsg}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
