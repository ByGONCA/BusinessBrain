"use client";

import * as React from "react";
import Link from "next/link";
import {
  GripVertical,
  Trash2,
  ChevronUp,
  ChevronDown,
  Copy,
  Check,
  Sparkles,
  Link2,
  CopyPlus,
  Plus,
  MessageSquare,
  ChevronRight,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  CheckSquare,
  Quote,
  Code as CodeIcon,
  Image as ImageIcon,
  Video as VideoIcon,
  Music,
  FileText,
  Bookmark,
  Table as TableIcon,
  Kanban,
  LayoutGrid,
  ListFilter,
  Calendar,
  Sigma,
  ListTree,
  FolderTree,
  MousePointerClick,
  Brain,
  Scale,
  FolderGit2,
  CalendarClock,
  Target,
  Cloud,
  HardDrive,
  AlertTriangle,
  ExternalLink,
  Download,
  ZoomIn,
  Upload,
  FileSpreadsheet,
  FileCode,
  Github,
  Pencil,
  Eye,
  Loader2,
} from "lucide-react";
import {
  EditorBlock,
  BlockType,
  PageConnectionRecord,
  RelationType,
  RELATION_LABELS,
  PageAuthorProfile,
} from "@/lib/pages/types";
import { FilePreviewInfo } from "@/lib/files/types";
import { getFilePreviewAction } from "@/lib/files/actions";
import {
  detectLanguageFromPath,
  getTokenClasses,
  tokenizeCodeToLines,
} from "@/lib/code-viewer/syntax";
import { formatRelativeTime, formatExactDateTime } from "@/lib/utils/time";
import { EmojiPicker } from "./emoji-picker";
import { focusBlockCaretEnd, restoreCaretOffset, getCaretOffset } from "./caret-utils";
import { CompanyBrainToolbarAction } from "./floating-format-toolbar";
import { PdfViewerModal } from "./pdf-viewer-modal";
import { useSettings } from "@/components/dashboard/settings/settings-context";
import { PageCalendarBlock } from "@/components/dashboard/calendar/page-calendar-block";
import { cn } from "@/lib/utils";

interface BlockItemProps {
  block: EditorBlock;
  index: number;
  allBlocks?: EditorBlock[];
  pageTitle?: string;
  filePreview?: FilePreviewInfo;
  onOpenFilePicker?: (blockId: string, allowedTypes: "all" | "image" | "video" | "audio" | "pdf" | "document") => void;
  listNumber?: number;
  totalBlocks: number;
  isFocused: boolean;
  isDragging?: boolean;
  dropIndicatorPosition?: "before" | "after" | null;
  isSelected?: boolean;
  connections?: PageConnectionRecord[];
  fallbackAuthorProfile?: PageAuthorProfile | null;
  fallbackAuthorDate?: string;
  isAuthorHighlighted?: boolean;
  onToggleAuthorHighlight?: (authorKey: string) => void;
  highlightedAuthorKey?: string | null;
  onUpdateContent: (id: string, content: string) => void;
  onUpdateProperties: (id: string, properties: Partial<EditorBlock["properties"]>) => void;
  onConvertType: (id: string, newType: BlockType, newContent?: string) => void;
  onInsertBelow: (index: number, type?: BlockType) => void;
  onDeleteBlock: (id: string) => void;
  onMoveUp: (index: number) => void;
  onMoveDown: (index: number) => void;
  onDuplicateBlock?: (index: number) => void;
  onConnectBlock?: (blockId: string, initialText: string) => void;
  onCompanyBrainAction?: (actionId: CompanyBrainToolbarAction, text: string) => void;
  onClickConnection?: (connection: PageConnectionRecord) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLElement>, block: EditorBlock, index: number) => void;
  onSlashTrigger: (blockId: string, rect: DOMRect, initialQuery?: string) => void;
  onMentionTrigger?: (blockId: string, rect: DOMRect, initialQuery?: string) => void;
  registerRef: (id: string, el: HTMLElement | null) => void;
  onFocusBlock?: (id: string) => void;
  onDragBlockStart?: (index: number, e: React.DragEvent) => void;
  onDragBlockOver?: (index: number, position: "before" | "after") => void;
  onDragBlockLeave?: (index: number) => void;
  onDragBlockEnd?: () => void;
  onDropBlock?: (index: number, position: "before" | "after") => void;
}

interface TableBlockContentProps {
  block: EditorBlock;
  onUpdateProperties: (id: string, properties: Record<string, unknown>) => void;
}

function TableBlockContent({ block, onUpdateProperties }: TableBlockContentProps) {
  const tableData = block.properties?.tableData || {
    headers: ["Column 1", "Column 2", "Column 3"],
    rows: [["", "", ""], ["", "", ""]],
  };

  const colCount = tableData.headers.length;
  const defaultShare = Math.round(100 / colCount);

  // Initialize or read colWidths (percentages)
  const currentWidths = React.useMemo(() => {
    if (tableData.colWidths && tableData.colWidths.length === colCount) {
      return tableData.colWidths;
    }
    return tableData.headers.map(() => defaultShare);
  }, [tableData.colWidths, colCount, defaultShare]);

  const [colWidths, setColWidths] = React.useState<number[]>(currentWidths);
  const colWidthsRef = React.useRef<number[]>(currentWidths);
  colWidthsRef.current = colWidths;

  React.useEffect(() => {
    setColWidths(currentWidths);
  }, [currentWidths]);

  const tableRef = React.useRef<HTMLTableElement | null>(null);
  const resizingRef = React.useRef<{
    cIdx: number;
    startX: number;
    startWidths: number[];
    tableWidth: number;
  } | null>(null);

  const startResize = (cIdx: number, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const tableWidth = tableRef.current?.getBoundingClientRect().width || 600;
    resizingRef.current = {
      cIdx,
      startX: e.clientX,
      startWidths: [...colWidthsRef.current],
      tableWidth,
    };

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!resizingRef.current) return;
      const { cIdx: activeIdx, startX, startWidths, tableWidth: tWidth } = resizingRef.current;
      const deltaX = moveEvent.clientX - startX;
      const deltaPercent = Math.round((deltaX / tWidth) * 100);

      const nextWidths = [...startWidths];
      // Bound column width between 10% and 80%
      const newWidth = Math.max(10, Math.min(80, startWidths[activeIdx] + deltaPercent));
      nextWidths[activeIdx] = newWidth;

      colWidthsRef.current = nextWidths;
      setColWidths(nextWidths);
    };

    const handleMouseUp = () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      if (resizingRef.current) {
        onUpdateProperties(block.id, {
          tableData: {
            ...tableData,
            colWidths: colWidthsRef.current,
          },
        });
        resizingRef.current = null;
      }
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };

  const updateCell = (rowIndex: number, colIndex: number, value: string) => {
    const nextRows = tableData.rows.map((row, rIdx) => {
      if (rIdx !== rowIndex) return row;
      const nextRow = [...row];
      nextRow[colIndex] = value;
      return nextRow;
    });
    onUpdateProperties(block.id, { tableData: { ...tableData, rows: nextRows } });
  };

  const updateHeader = (colIndex: number, value: string) => {
    const nextHeaders = [...tableData.headers];
    nextHeaders[colIndex] = value;
    onUpdateProperties(block.id, { tableData: { ...tableData, headers: nextHeaders } });
  };

  const addRow = () => {
    const emptyRow = new Array(tableData.headers.length).fill("");
    onUpdateProperties(block.id, { tableData: { ...tableData, rows: [...tableData.rows, emptyRow] } });
  };

  const addColumn = () => {
    const nextHeaders = [...tableData.headers, `Column ${tableData.headers.length + 1}`];
    const nextRows = tableData.rows.map((r) => [...r, ""]);
    const nextShare = Math.round(100 / nextHeaders.length);
    const nextWidths = nextHeaders.map(() => nextShare);
    onUpdateProperties(block.id, {
      tableData: { headers: nextHeaders, rows: nextRows, colWidths: nextWidths },
    });
  };

  const deleteRow = (rIdx: number) => {
    if (tableData.rows.length <= 1) return;
    const nextRows = tableData.rows.filter((_, idx) => idx !== rIdx);
    onUpdateProperties(block.id, { tableData: { ...tableData, rows: nextRows } });
  };

  const deleteColumn = (cIdx: number) => {
    if (tableData.headers.length <= 1) return;
    const nextHeaders = tableData.headers.filter((_, idx) => idx !== cIdx);
    const nextRows = tableData.rows.map((r) => r.filter((_, idx) => idx !== cIdx));
    const nextShare = Math.round(100 / nextHeaders.length);
    const nextWidths = nextHeaders.map(() => nextShare);
    onUpdateProperties(block.id, {
      tableData: { headers: nextHeaders, rows: nextRows, colWidths: nextWidths },
    });
  };

  const resetEqualWidths = () => {
    const nextShare = Math.round(100 / tableData.headers.length);
    const nextWidths = tableData.headers.map(() => nextShare);
    onUpdateProperties(block.id, {
      tableData: { ...tableData, colWidths: nextWidths },
    });
  };

  return (
    <div className="my-2 overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 p-2 shadow-2xs">
      <table ref={tableRef} className="w-full min-w-[320px] text-left text-xs border-collapse table-fixed">
        <colgroup>
          {tableData.headers.map((_, cIdx) => (
            <col
              key={cIdx}
              style={{
                width: `${colWidths[cIdx] || defaultShare}%`,
              }}
            />
          ))}
          <col style={{ width: "32px" }} />
        </colgroup>
        <thead>
          <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/40">
            {tableData.headers.map((h, cIdx) => (
              <th
                key={cIdx}
                style={{ width: `${colWidths[cIdx] || defaultShare}%` }}
                className="p-2 border-r border-zinc-200 dark:border-zinc-800 last:border-r-0 group/col relative align-top"
              >
                <textarea
                  rows={1}
                  value={h}
                  placeholder={`Column ${cIdx + 1}`}
                  onChange={(e) => {
                    updateHeader(cIdx, e.target.value);
                    e.target.style.height = "auto";
                    e.target.style.height = `${e.target.scrollHeight}px`;
                  }}
                  ref={(el) => {
                    if (el) {
                      el.style.height = "auto";
                      el.style.height = `${el.scrollHeight}px`;
                    }
                  }}
                  className="w-full font-semibold text-zinc-700 dark:text-zinc-300 bg-transparent border-none outline-none resize-none leading-snug whitespace-pre-wrap break-words block overflow-hidden p-0 pr-5"
                />
                {tableData.headers.length > 1 && (
                  <button
                    type="button"
                    onClick={() => deleteColumn(cIdx)}
                    className="absolute right-3 top-2 opacity-0 group-hover/col:opacity-100 text-zinc-400 hover:text-red-500 transition-opacity z-10"
                    title="Delete column"
                  >
                    ×
                  </button>
                )}
                {/* Column Resizer Handle */}
                <div
                  role="separator"
                  aria-orientation="vertical"
                  onMouseDown={(e) => startResize(cIdx, e)}
                  className="absolute -right-1 top-0 bottom-0 w-2 cursor-col-resize z-20 select-none"
                  title="Drag to resize column width"
                />
              </th>
            ))}
            <th className="w-8 p-1 text-center align-middle">
              <button
                type="button"
                onClick={addColumn}
                className="h-5 w-5 rounded hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-500 inline-flex items-center justify-center"
                title="Add column"
              >
                +
              </button>
            </th>
          </tr>
        </thead>
        <tbody>
          {tableData.rows.map((row, rIdx) => (
            <tr key={rIdx} className="border-b border-zinc-100 dark:border-zinc-800/60 last:border-b-0 group/row">
              {row.map((cell, cIdx) => (
                <td
                  key={cIdx}
                  style={{ width: `${colWidths[cIdx] || defaultShare}%` }}
                  className="p-2 border-r border-zinc-100 dark:border-zinc-800/60 last:border-r-0 align-top"
                >
                  <textarea
                    rows={1}
                    value={cell}
                    placeholder="Type text..."
                    onChange={(e) => {
                      updateCell(rIdx, cIdx, e.target.value);
                      e.target.style.height = "auto";
                      e.target.style.height = `${e.target.scrollHeight}px`;
                    }}
                    ref={(el) => {
                      if (el) {
                        el.style.height = "auto";
                        el.style.height = `${el.scrollHeight}px`;
                      }
                    }}
                    className="w-full bg-transparent border-none outline-none resize-none text-zinc-800 dark:text-zinc-200 leading-relaxed whitespace-pre-wrap break-words block overflow-hidden p-0"
                  />
                </td>
              ))}
              <td className="w-8 p-1 text-center align-middle">
                {tableData.rows.length > 1 && (
                  <button
                    type="button"
                    onClick={() => deleteRow(rIdx)}
                    className="h-5 w-5 rounded opacity-0 group-hover/row:opacity-100 hover:text-red-500 text-zinc-400 transition-opacity"
                    title="Delete row"
                  >
                    ×
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="pt-2 flex items-center justify-between border-t border-zinc-100 dark:border-zinc-800 mt-2">
        <button
          type="button"
          onClick={addRow}
          className="text-[11px] font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
        >
          + Add row
        </button>
        <button
          type="button"
          onClick={resetEqualWidths}
          className="text-[10px] text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
          title="Reset all columns to equal width"
        >
          ⇋ Equal column sizes
        </button>
      </div>
    </div>
  );
}

interface ColumnsBlockContentProps {
  block: EditorBlock;
  onUpdateProperties: (id: string, properties: Record<string, unknown>) => void;
}

function ColumnsBlockContent({ block, onUpdateProperties }: ColumnsBlockContentProps) {
  const columnsData = block.properties?.columnsData || {
    leftTitle: "Left Column",
    rightTitle: "Right Column",
    leftContent: block.content || "",
    rightContent: "",
    splitPercent: 50,
  };
  const split = columnsData.splitPercent ?? 50;

  return (
    <div className="my-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/30 dark:bg-zinc-900/30 p-2.5">
      <div className="flex items-center justify-between pb-2 mb-2 border-b border-zinc-200/60 dark:border-zinc-800 text-[11px] text-zinc-500">
        <span className="font-semibold flex items-center gap-1.5 text-zinc-700 dark:text-zinc-300">
          <LayoutGrid className="h-3.5 w-3.5 text-indigo-500" />
          Side by Side Columns
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onUpdateProperties(block.id, { columnsData: { ...columnsData, splitPercent: 33 } })}
            className={cn("px-1.5 py-0.5 rounded text-[10px] transition-colors", split === 33 ? "bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 font-semibold" : "hover:bg-zinc-100 dark:hover:bg-zinc-800")}
            title="30% / 70% split"
          >
            30/70
          </button>
          <button
            type="button"
            onClick={() => onUpdateProperties(block.id, { columnsData: { ...columnsData, splitPercent: 50 } })}
            className={cn("px-1.5 py-0.5 rounded text-[10px] transition-colors", split === 50 ? "bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 font-semibold" : "hover:bg-zinc-100 dark:hover:bg-zinc-800")}
            title="50% / 50% split"
          >
            50/50
          </button>
          <button
            type="button"
            onClick={() => onUpdateProperties(block.id, { columnsData: { ...columnsData, splitPercent: 67 } })}
            className={cn("px-1.5 py-0.5 rounded text-[10px] transition-colors", split === 67 ? "bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 font-semibold" : "hover:bg-zinc-100 dark:hover:bg-zinc-800")}
            title="70% / 30% split"
          >
            70/30
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-start">
        {/* Left Column */}
        <div
          style={{ gridColumn: `span ${Math.round((split / 100) * 12)}` }}
          className="rounded-lg border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900/70 p-2.5 shadow-2xs"
        >
          <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1">
            {columnsData.leftTitle || "Left Side"}
          </div>
          <textarea
            rows={3}
            value={columnsData.leftContent || ""}
            placeholder="Type left side content..."
            onChange={(e) => {
              onUpdateProperties(block.id, {
                columnsData: { ...columnsData, leftContent: e.target.value },
              });
              e.target.style.height = "auto";
              e.target.style.height = `${e.target.scrollHeight}px`;
            }}
            ref={(el) => {
              if (el) {
                el.style.height = "auto";
                el.style.height = `${el.scrollHeight}px`;
              }
            }}
            className="w-full bg-transparent border-none outline-none resize-none text-xs text-zinc-800 dark:text-zinc-200 leading-relaxed whitespace-pre-wrap break-words block p-0"
          />
        </div>

        {/* Right Column */}
        <div
          style={{ gridColumn: `span ${12 - Math.round((split / 100) * 12)}` }}
          className="rounded-lg border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900/70 p-2.5 shadow-2xs"
        >
          <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1">
            {columnsData.rightTitle || "Right Side"}
          </div>
          <textarea
            rows={3}
            value={columnsData.rightContent || ""}
            placeholder="Type right side content..."
            onChange={(e) => {
              onUpdateProperties(block.id, {
                columnsData: { ...columnsData, rightContent: e.target.value },
              });
              e.target.style.height = "auto";
              e.target.style.height = `${e.target.scrollHeight}px`;
            }}
            ref={(el) => {
              if (el) {
                el.style.height = "auto";
                el.style.height = `${el.scrollHeight}px`;
              }
            }}
            className="w-full bg-transparent border-none outline-none resize-none text-xs text-zinc-800 dark:text-zinc-200 leading-relaxed whitespace-pre-wrap break-words block p-0"
          />
        </div>
      </div>
    </div>
  );
}

interface ImageBlockContentProps {
  block: EditorBlock;
  blockAlign?: "left" | "right" | "full";
  filePreview?: FilePreviewInfo;
  onUpdateProperties: (id: string, properties: Partial<EditorBlock["properties"]>) => void;
  onOpenFilePicker?: (blockId: string, allowedTypes: "all" | "image" | "video" | "audio" | "pdf" | "document") => void;
  onOpenLightbox: (src: string) => void;
}

function ImageBlockContent({
  block,
  blockAlign = "full",
  filePreview,
  onUpdateProperties,
  onOpenFilePicker,
  onOpenLightbox,
}: ImageBlockContentProps) {
  const [localUrl, setLocalUrl] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [hasError, setHasError] = React.useState(false);
  const [retryCount, setRetryCount] = React.useState(0);

  const fileId = block.properties?.fileId;
  const rawMediaUrl = block.properties?.mediaUrl;
  const isDirectWebUrl = Boolean(
    rawMediaUrl &&
      (rawMediaUrl.startsWith("http://") ||
        rawMediaUrl.startsWith("https://") ||
        rawMediaUrl.startsWith("data:") ||
        rawMediaUrl.startsWith("blob:"))
  );

  // Determine active display URL:
  // 1. filePreview.previewUrl if supplied via batch resolution
  // 2. localUrl if resolved dynamically on mount or retry
  // 3. rawMediaUrl only if it is a valid web URL (never a raw storage path)
  const activeUrl = filePreview?.previewUrl || localUrl || (isDirectWebUrl ? rawMediaUrl : null);

  React.useEffect(() => {
    if (!fileId) return;
    if (filePreview?.previewUrl) {
      setLocalUrl(filePreview.previewUrl);
      setHasError(false);
      return;
    }

    let isMounted = true;
    setIsLoading(true);
    setHasError(false);

    getFilePreviewAction(fileId)
      .then((preview) => {
        if (!isMounted) return;
        if (preview?.previewUrl) {
          setLocalUrl(preview.previewUrl);
          setHasError(false);
        } else {
          setHasError(true);
        }
      })
      .catch(() => {
        if (isMounted) setHasError(true);
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [fileId, filePreview?.previewUrl, retryCount]);

  const handleRefresh = (e: React.MouseEvent) => {
    e.stopPropagation();
    setHasError(false);
    setRetryCount((c) => c + 1);
  };

  const handleImageError = () => {
    if (fileId && retryCount === 0) {
      setRetryCount(1);
    } else {
      setHasError(true);
    }
  };

  const isUnavailable = block.properties?.fileStatus === "unavailable";
  const { openSettings } = useSettings();

  if (isUnavailable) {
    return (
      <div className="p-4 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 text-xs text-amber-800 dark:text-amber-300 flex items-center justify-between my-2">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
          <span>External image unavailable — reconnect Google Drive to access.</span>
        </div>
        <button
          type="button"
          onClick={() => openSettings("integrations")}
          className="px-2.5 py-1 rounded-md bg-amber-600 hover:bg-amber-500 text-white font-medium text-[11px] transition-colors"
        >
          Reconnect
        </button>
      </div>
    );
  }

  if (isLoading && !activeUrl) {
    return (
      <div className="my-2 p-8 rounded-xl border border-dashed border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/40 flex flex-col items-center justify-center gap-2 text-zinc-400">
        <Loader2 className="h-5 w-5 animate-spin text-indigo-500" />
        <span className="text-xs">Loading image...</span>
      </div>
    );
  }

  if (hasError) {
    return (
      <div className="my-2 p-4 rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50/50 dark:bg-red-950/20 text-xs text-red-700 dark:text-red-400 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>Image unavailable or preview expired.</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleRefresh}
            className="px-2.5 py-1 rounded-md bg-red-600 hover:bg-red-500 text-white font-medium text-[11px] transition-colors"
          >
            Retry
          </button>
          {onOpenFilePicker && (
            <button
              type="button"
              onClick={() => onOpenFilePicker(block.id, "image")}
              className="px-2.5 py-1 rounded-md border border-red-300 dark:border-red-800 hover:bg-red-100 dark:hover:bg-red-900/40 text-[11px] transition-colors"
            >
              Replace
            </button>
          )}
        </div>
      </div>
    );
  }

  if (activeUrl) {
    return (
      <div className="space-y-1.5 py-1 my-2">
        <div
          className={cn(
            "relative group/img flex items-center justify-center transition-all",
            blockAlign === "left" && "mr-auto max-w-lg",
            blockAlign === "right" && "ml-auto max-w-lg",
            blockAlign === "full" && "max-w-2xl mx-auto"
          )}
        >
          <img
            src={activeUrl}
            alt={block.properties?.caption || "Image"}
            className="max-h-96 w-auto rounded-lg object-contain cursor-pointer"
            onClick={() => onOpenLightbox(activeUrl)}
            onError={handleImageError}
          />
          {/* Side/Alignment Quick Controls on hover */}
          <div className="absolute top-2 right-2 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center gap-1 bg-black/60 backdrop-blur-sm px-1.5 py-1 rounded-lg text-white text-[10px]">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onUpdateProperties(block.id, { align: "left" });
              }}
              className={cn("px-1 py-0.5 rounded hover:bg-white/20 transition-colors", blockAlign === "left" && "bg-white/30 font-bold")}
              title="Align Left (50% side)"
            >
              ← Left
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onUpdateProperties(block.id, { align: "full" });
              }}
              className={cn("px-1 py-0.5 rounded hover:bg-white/20 transition-colors", blockAlign === "full" && "bg-white/30 font-bold")}
              title="Center / Full Width"
            >
              ↔ Full
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onUpdateProperties(block.id, { align: "right" });
              }}
              className={cn("px-1 py-0.5 rounded hover:bg-white/20 transition-colors", blockAlign === "right" && "bg-white/30 font-bold")}
              title="Align Right (50% side)"
            >
              Right →
            </button>
          </div>
        </div>
        <input
          type="text"
          value={block.properties?.caption || ""}
          onChange={(e) => onUpdateProperties(block.id, { caption: e.target.value })}
          placeholder="Add a caption..."
          className="w-full text-center text-xs text-zinc-400 bg-transparent border-none outline-none focus:text-zinc-700 dark:focus:text-zinc-200"
        />
      </div>
    );
  }

  // Empty state: Attach / Upload
  return (
    <div className="my-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 p-6 flex flex-col items-center justify-center gap-3 text-zinc-400">
      <ImageIcon className="h-8 w-8 text-zinc-300 dark:text-zinc-600" />
      <div className="flex flex-col sm:flex-row items-center gap-2 max-w-md w-full">
        {onOpenFilePicker && (
          <button
            type="button"
            onClick={() => onOpenFilePicker(block.id, "image")}
            className="w-full sm:w-auto px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium flex items-center justify-center gap-1.5 transition-colors shrink-0"
          >
            <Upload className="h-3.5 w-3.5" /> Attach / Upload Image
          </button>
        )}
        <div className="flex items-center gap-1.5 w-full">
          <input
            type="url"
            placeholder="Or paste image URL..."
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                const val = (e.target as HTMLInputElement).value.trim();
                if (val) onUpdateProperties(block.id, { mediaUrl: val });
              }
            }}
            className="flex-1 px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs text-zinc-800 dark:text-zinc-200 outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
      </div>
    </div>
  );
}

export function BlockItem({
  block,
  index,
  allBlocks = [],
  pageTitle = "Page",
  filePreview,
  listNumber,
  totalBlocks,
  isFocused,
  isDragging,
  dropIndicatorPosition,
  isSelected = false,
  connections = [],
  onUpdateContent,
  onUpdateProperties,
  onConvertType,
  onInsertBelow,
  onDeleteBlock,
  onMoveUp,
  onMoveDown,
  onDuplicateBlock,
  onConnectBlock,
  onCompanyBrainAction,
  onClickConnection,
  onKeyDown,
  onSlashTrigger,
  onMentionTrigger,
  registerRef,
  onFocusBlock,
  onOpenFilePicker,
  onDragBlockStart,
  onDragBlockOver,
  onDragBlockLeave,
  onDragBlockEnd,
  onDropBlock,
  fallbackAuthorProfile,
  fallbackAuthorDate,
  isAuthorHighlighted = false,
  onToggleAuthorHighlight,
  highlightedAuthorKey,
  onOpenSettings,
}: BlockItemProps & { onOpenSettings?: () => void }) {
  const authorName =
    block.author?.name ||
    fallbackAuthorProfile?.full_name ||
    block.author?.email?.split("@")[0] ||
    fallbackAuthorProfile?.email?.split("@")[0] ||
    "Author";

  const authorKey =
    block.author?.userId ||
    block.author?.name ||
    block.author?.email ||
    fallbackAuthorProfile?.id ||
    fallbackAuthorProfile?.full_name ||
    authorName;

  const authorAvatarUrl = block.author?.avatarUrl || fallbackAuthorProfile?.avatar_url || null;
  const authorDate = block.author?.editedAt || fallbackAuthorDate || new Date().toISOString();
  const authorRelativeTime = formatRelativeTime(authorDate);
  const authorExactTime = formatExactDateTime(authorDate);
  const hasContent = Boolean(block.content && block.content.trim().length > 0);

  const { openSettings } = useSettings();
  const [copied, setCopied] = React.useState(false);
  const [linkCopied, setLinkCopied] = React.useState(false);
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [transformOpen, setTransformOpen] = React.useState(false);
  const [isSelfFocused, setIsSelfFocused] = React.useState(false);
  const [isPdfOpen, setIsPdfOpen] = React.useState(false);
  const [isLightboxOpen, setIsLightboxOpen] = React.useState(false);
  const [lightboxSrc, setLightboxSrc] = React.useState<string | null>(null);
  const [isEditingCode, setIsEditingCode] = React.useState(!block.content && block.type === "code");
  const blockContainerRef = React.useRef<HTMLDivElement>(null);
  const menuRef = React.useRef<HTMLDivElement>(null);
  const editableRef = React.useRef<HTMLElement | null>(null);
  const prevTypeRef = React.useRef(block.type);
  const lastCaretOffsetRef = React.useRef<number | null>(null);
  const isTypingRef = React.useRef(false);

  // GitHub code snippet properties and syntax resolution
  const isGitHubSnippet = Boolean(
    block.type === "code" && (block.properties?.isGitHubSnippet || block.properties?.filePath)
  );
  const gitHubFilePath = block.properties?.filePath as string | undefined;
  const gitHubFileName = gitHubFilePath ? gitHubFilePath.split("/").pop() || gitHubFilePath : "";
  const gitHubHtmlUrl = block.properties?.htmlUrl as string | undefined;
  const fullFilePath = gitHubFilePath || gitHubFileName || "ficheiro";
  const repoFullName =
    (block.properties?.repoFullName as string | undefined) ||
    (gitHubHtmlUrl ? gitHubHtmlUrl.match(/github\.com\/([^/]+)\/([^/]+)/)?.[0]?.replace("github.com/", "").replace(/\.git$/, "") : undefined);
  const codeStartLine = typeof block.properties?.startLine === "number" ? block.properties.startLine : 1;
  const codeEndLine = typeof block.properties?.endLine === "number" ? block.properties.endLine : undefined;
  const lineQuery = codeStartLine
    ? `&line=${codeStartLine}${codeEndLine && codeEndLine !== codeStartLine ? `-${codeEndLine}` : ""}`
    : "";
  const internalGitHubUrl = gitHubFilePath
    ? `/dashboard/github?${repoFullName ? `repo=${encodeURIComponent(repoFullName)}&` : ""}file=${encodeURIComponent(gitHubFilePath)}${lineQuery}`
    : undefined;
  const codeLanguage =
    (block.properties?.language as string) ||
    (gitHubFilePath ? detectLanguageFromPath(gitHubFilePath).lang : "plaintext");

  const tokenizedCodeLines = React.useMemo(() => {
    if (block.type !== "code") return [];
    return tokenizeCodeToLines(block.content, codeLanguage);
  }, [block.type, block.content, codeLanguage]);

  // Filter connections belonging directly to this block
  const blockConnections = React.useMemo(() => {
    return connections.filter(
      (c) => c.source_type === "block" && c.source_id === block.id
    );
  }, [connections, block.id]);

  // Synchronously restore focus when block type changes
  React.useLayoutEffect(() => {
    if (prevTypeRef.current !== block.type) {
      prevTypeRef.current = block.type;
      if (editableRef.current) {
        focusBlockCaretEnd(editableRef.current);
        setIsSelfFocused(true);
      }
    }
  }, [block.type]);

  // Restore caret position during re-renders caused by typing
  React.useLayoutEffect(() => {
    if (
      isTypingRef.current &&
      editableRef.current &&
      (document.activeElement === editableRef.current || editableRef.current.contains(document.activeElement))
    ) {
      if (lastCaretOffsetRef.current !== null) {
        restoreCaretOffset(editableRef.current, lastCaretOffsetRef.current);
        requestAnimationFrame(() => {
          if (
            editableRef.current &&
            (document.activeElement === editableRef.current || editableRef.current.contains(document.activeElement)) &&
            lastCaretOffsetRef.current !== null
          ) {
            restoreCaretOffset(editableRef.current, lastCaretOffsetRef.current);
          }
        });
      }
      isTypingRef.current = false;
    }
  }, [block.content]);

  // Focus block when external isFocused changes to true
  React.useEffect(() => {
    if (isFocused && editableRef.current && document.activeElement !== editableRef.current) {
      focusBlockCaretEnd(editableRef.current);
      setIsSelfFocused(true);
    }
  }, [isFocused]);

  const handleFocus = () => {
    setIsSelfFocused(true);
    onFocusBlock?.(block.id);
  };

  const handleBlur = () => {
    setIsSelfFocused(false);
  };

  const showPlaceholder = isSelfFocused || isFocused || (index === 0 && totalBlocks === 1 && !block.content);

  const isLineActive = isSelfFocused || isFocused || isAuthorHighlighted;

  const renderBlame = (forceShow = false) => {
    if (!hasContent && !forceShow) return null;

    return (
      <button
        type="button"
        contentEditable={false}
        onClick={(e) => {
          e.stopPropagation();
          onToggleAuthorHighlight?.(authorKey);
        }}
        className={cn(
          "items-center gap-1.5 ml-2.5 px-1 py-0.5 text-[11px] font-sans transition-all duration-150 select-none cursor-pointer align-baseline shrink-0",
          isLineActive || forceShow ? "inline-flex" : "hidden group-hover:inline-flex",
          isAuthorHighlighted
            ? "opacity-100 text-blue-600 dark:text-blue-400 font-semibold"
            : "opacity-40 hover:opacity-100 text-zinc-400 dark:text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
        )}
        title={`Edited by ${authorName} · ${authorRelativeTime} (${authorExactTime})\nClick to highlight all edits by ${authorName} on this page`}
      >
        {authorAvatarUrl ? (
          <img
            src={authorAvatarUrl}
            alt={authorName}
            className="h-3.5 w-3.5 rounded-full object-cover shrink-0"
          />
        ) : (
          <span className="h-3.5 w-3.5 rounded-full bg-blue-600/20 text-blue-400 text-[9px] font-bold flex items-center justify-center uppercase shrink-0 border border-blue-500/30">
            {authorName.charAt(0)}
          </span>
        )}
        <span className="font-medium truncate max-w-[130px]">{authorName}</span>
        <span className="text-[10px] text-zinc-400 dark:text-zinc-500 font-normal">
          · {authorRelativeTime}
        </span>
      </button>
    );
  };

  // Sync ref registration
  const setRef = React.useCallback(
    (el: HTMLElement | null) => {
      editableRef.current = el;
      registerRef(block.id, el);
    },
    [block.id, registerRef]
  );

  // Handle outside click to close action menu
  React.useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
        setTransformOpen(false);
      }
    }
    if (menuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [menuOpen]);

  const handleCopyCode = async () => {
    await navigator.clipboard.writeText(block.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Input change with Markdown auto-formatting shortcuts and slash/@ detection
  const handleInput = (e: React.FormEvent<HTMLElement>) => {
    const target = e.currentTarget;
    // Extract text safely: textContent preserves all spaces and doesn't collapse trailing spaces
    let rawText = target.textContent || "";
    if (target.innerHTML.includes("<br") || target.innerHTML.includes("<div") || target.innerHTML.includes("<p")) {
      const inner = target.innerText || "";
      if (rawText.endsWith(" ") && !inner.endsWith(" ")) {
        rawText = inner + " ";
      } else {
        rawText = inner;
      }
    }
    const text = rawText.replace(/\u00a0/g, " ");
    isTypingRef.current = true;
    lastCaretOffsetRef.current = getCaretOffset(target);

    // Check for inline markdown shortcuts on paragraphs or headings (# -> H1, ## -> H2, ### -> H3)
    if (["paragraph", "heading_1", "heading_2", "heading_3"].includes(block.type)) {
      if (text.startsWith("### ")) {
        e.preventDefault();
        onConvertType(block.id, "heading_3", text.slice(4));
        return;
      }
      if (text.startsWith("## ")) {
        e.preventDefault();
        onConvertType(block.id, "heading_2", text.slice(3));
        return;
      }
      if (text.startsWith("# ")) {
        e.preventDefault();
        onConvertType(block.id, "heading_1", text.slice(2));
        return;
      }
    }

    // Additional standard markdown shortcuts on paragraphs
    if (block.type === "paragraph") {
      if (text.startsWith("- ") || text.startsWith("* ")) {
        e.preventDefault();
        onConvertType(block.id, "bullet_list", text.slice(2));
        return;
      }
      if (/^\d+\.\s/.test(text)) {
        e.preventDefault();
        onConvertType(block.id, "numbered_list", text.replace(/^\d+\.\s/, ""));
        return;
      }
      if (text.startsWith("[] ") || text.startsWith("[ ] ")) {
        e.preventDefault();
        onConvertType(block.id, "checklist", text.replace(/^\[\s?\]\s?/, ""));
        return;
      }
      if (text.startsWith("> ")) {
        e.preventDefault();
        onConvertType(block.id, "quote", text.slice(2));
        return;
      }
      if (text.startsWith("---")) {
        e.preventDefault();
        onConvertType(block.id, "divider", "");
        return;
      }
      if (text.startsWith("```")) {
        e.preventDefault();
        onConvertType(block.id, "code", text.slice(3).trim());
        return;
      }
    }

    // Slash command trigger
    const slashMatch = /(?:^|\s)\/([a-zA-Z0-9_-]*)$/.exec(text);
    if (slashMatch) {
      const rect = e.currentTarget.getBoundingClientRect();
      onSlashTrigger(block.id, rect, slashMatch[1]);
    }

    // Mention command trigger
    const mentionMatch = /(?:^|\s)@([a-zA-Z0-9_-]*)$/.exec(text);
    if (mentionMatch) {
      const rect = e.currentTarget.getBoundingClientRect();
      onMentionTrigger?.(block.id, rect, mentionMatch[1]);
    }

    onUpdateContent(block.id, text);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "move";
    const rect = e.currentTarget.getBoundingClientRect();
    const relY = e.clientY - rect.top;
    const position = relY < rect.height / 2 ? "before" : "after";
    onDragBlockOver?.(index, position);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      onDragBlockLeave?.(index);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    const relY = e.clientY - rect.top;
    const position = relY < rect.height / 2 ? "before" : "after";
    onDropBlock?.(index, position);
  };

  const gripTopClass =
    block.type === "heading_1"
      ? "top-1.5"
      : block.type === "heading_2"
      ? "top-1"
      : "top-0.5";

  const blockAlign = (block.properties?.align as "left" | "right" | "full" | undefined) || "full";

  return (
    <div
      ref={blockContainerRef}
      id={`block-${block.id}`}
      data-block-id={block.id}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={cn(
        "group relative flex flex-col -ml-10 pl-10 pr-2 py-1 transition-all duration-150 rounded-lg",
        blockAlign === "left" && "w-full md:w-[48%] md:float-left md:mr-[4%] clear-none mb-2",
        blockAlign === "right" && "w-full md:w-[48%] md:float-right clear-none mb-2",
        blockAlign === "full" && "w-full clear-both",
        index > 0 && block.type === "heading_1" && "mt-5",
        index > 0 && block.type === "heading_2" && "mt-3.5",
        index > 0 && block.type === "heading_3" && "mt-2",
        isDragging && "opacity-35",
        isSelected && (
          block.type === "board" || block.type === "calendar" || block.type === "table" || block.type === "gallery"
            ? "ring-1 ring-blue-500/40 dark:ring-blue-400/40 shadow-xs"
            : "bg-blue-50/40 dark:bg-blue-950/30 ring-1 ring-blue-500/30 dark:ring-blue-400/30 shadow-xs"
        )
      )}
    >
      {/* Drop indicator: BEFORE */}
      {dropIndicatorPosition === "before" && (
        <div className="h-0.5 w-full bg-blue-500 rounded-full mb-1 shadow-xs pointer-events-none animate-in fade-in duration-100" />
      )}

      <div className="relative flex items-start w-full">
        {/* Block Action Controls (Grip handle in gutter) */}
        <div className={cn("absolute -left-7 flex items-center opacity-0 group-hover:opacity-100 transition-opacity", gripTopClass)}>
          <div className="relative" ref={menuRef}>
            <div
              role="button"
              tabIndex={0}
              draggable
              onDragStart={(e) => {
                e.stopPropagation();
                e.dataTransfer.setData("text/plain", block.id);
                e.dataTransfer.effectAllowed = "move";
                if (blockContainerRef.current) {
                  try {
                    e.dataTransfer.setDragImage(blockContainerRef.current, 20, 20);
                  } catch {}
                }
                onDragBlockStart?.(index, e);
              }}
              onDragEnd={() => {
                onDragBlockEnd?.();
              }}
              onClick={(e) => {
                e.stopPropagation();
                setMenuOpen(!menuOpen);
              }}
              className="flex h-5 w-5 items-center justify-center rounded text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-grab active:cursor-grabbing select-none"
              title="Drag to reorder or click for actions"
            >
              <GripVertical className="h-3.5 w-3.5" />
            </div>

            {menuOpen && (
              <div className="absolute left-6 top-0 z-50 w-56 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-1.5 shadow-xl animate-in fade-in zoom-in-95 duration-100 select-none max-h-96 overflow-y-auto no-scrollbar">
                <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                  Quick Actions
                </div>

                {/* Side / Placement (Side-by-side or full width) */}
                <div className="px-2 pt-1 pb-0.5 text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                  Side / Placement
                </div>
                <div className="grid grid-cols-3 gap-1 px-1.5 pb-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      onUpdateProperties(block.id, { align: "left" });
                      setMenuOpen(false);
                    }}
                    className={cn(
                      "flex items-center justify-center gap-0.5 py-1 px-1 rounded text-[11px] border transition-colors",
                      blockAlign === "left"
                        ? "bg-indigo-50 border-indigo-300 text-indigo-600 dark:bg-indigo-950/60 dark:border-indigo-700 dark:text-indigo-400 font-semibold"
                        : "border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                    )}
                    title="Place on Left side (50% width)"
                  >
                    ← Left
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onUpdateProperties(block.id, { align: "full" });
                      setMenuOpen(false);
                    }}
                    className={cn(
                      "flex items-center justify-center gap-0.5 py-1 px-1 rounded text-[11px] border transition-colors",
                      blockAlign === "full"
                        ? "bg-indigo-50 border-indigo-300 text-indigo-600 dark:bg-indigo-950/60 dark:border-indigo-700 dark:text-indigo-400 font-semibold"
                        : "border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                    )}
                    title="Full Width"
                  >
                    ↔ Full
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onUpdateProperties(block.id, { align: "right" });
                      setMenuOpen(false);
                    }}
                    className={cn(
                      "flex items-center justify-center gap-0.5 py-1 px-1 rounded text-[11px] border transition-colors",
                      blockAlign === "right"
                        ? "bg-indigo-50 border-indigo-300 text-indigo-600 dark:bg-indigo-950/60 dark:border-indigo-700 dark:text-indigo-400 font-semibold"
                        : "border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                    )}
                    title="Place on Right side (50% width)"
                  >
                    Right →
                  </button>
                </div>

                {/* Transform */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setTransformOpen(!transformOpen)}
                    className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-xs text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                  >
                    <span className="flex items-center gap-2">
                      <Sparkles className="h-3.5 w-3.5 text-indigo-500" />
                      Transform
                    </span>
                    <ChevronRight className={cn("h-3 w-3 text-zinc-400 transition-transform", transformOpen && "rotate-90")} />
                  </button>

                  {transformOpen && (
                    <div className="my-1 pl-3 pr-1 py-1 space-y-0.5 border-l border-zinc-200 dark:border-zinc-800 ml-2">
                      <div className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider px-2 py-0.5">
                        Blocks
                      </div>
                      {(
                        [
                          { type: "paragraph", label: "Text", icon: "P" },
                          { type: "heading_1", label: "Heading 1", icon: Heading1 },
                          { type: "heading_2", label: "Heading 2", icon: Heading2 },
                          { type: "heading_3", label: "Heading 3", icon: Heading3 },
                          { type: "bullet_list", label: "Bullet list", icon: List },
                          { type: "numbered_list", label: "Numbered list", icon: ListOrdered },
                          { type: "checklist", label: "To-do list", icon: CheckSquare },
                          { type: "toggle", label: "Toggle list", icon: ChevronRight },
                          { type: "quote", label: "Quote", icon: Quote },
                          { type: "code", label: "Code", icon: CodeIcon },
                          { type: "table", label: "Table", icon: TableIcon },
                          { type: "board", label: "Board (Kanban)", icon: Kanban },
                          { type: "gallery", label: "Gallery", icon: LayoutGrid },
                          { type: "list", label: "List View", icon: ListFilter },
                          { type: "calendar", label: "Calendar", icon: Calendar },
                          { type: "equation", label: "Equation", icon: Sigma },
                          { type: "button", label: "Button", icon: MousePointerClick },
                          { type: "columns", label: "2 Columns (Side by Side)", icon: LayoutGrid },
                        ] as const
                      ).map((item) => {
                        const ItemIcon = item.icon;
                        return (
                          <button
                            key={item.type}
                            type="button"
                            onClick={() => {
                              onConvertType(block.id, item.type as BlockType);
                              setTransformOpen(false);
                              setMenuOpen(false);
                            }}
                            className={cn(
                              "flex w-full items-center gap-2 rounded-md px-2 py-1 text-[11px] text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors",
                              block.type === item.type && "font-semibold text-indigo-600 dark:text-indigo-400"
                            )}
                          >
                            {typeof ItemIcon === "string" ? (
                              <span className="font-mono text-xs w-3 text-center">{ItemIcon}</span>
                            ) : (
                              <ItemIcon className="h-3 w-3" />
                            )}
                            <span>{item.label}</span>
                          </button>
                        );
                      })}

                      <div className="pt-1.5 text-[10px] font-semibold text-indigo-500 uppercase tracking-wider px-2 py-0.5 flex items-center gap-1">
                        <Sparkles className="h-2.5 w-2.5" /> Company Brain
                      </div>
                      {(
                        [
                          { action: "create-task" as CompanyBrainToolbarAction, label: "Create Task", icon: CheckSquare },
                          { action: "create-decision" as CompanyBrainToolbarAction, label: "Create Decision", icon: Scale },
                          { action: "add-project" as CompanyBrainToolbarAction, label: "Add to Project", icon: FolderGit2 },
                          { action: "add-meeting" as CompanyBrainToolbarAction, label: "Add to Meeting", icon: CalendarClock },
                          { action: "create-goal" as CompanyBrainToolbarAction, label: "Create Goal", icon: Target },
                          { action: "save-memory" as CompanyBrainToolbarAction, label: "Save as Memory", icon: Brain },
                        ] as const
                      ).map((item) => {
                        const ItemIcon = item.icon;
                        return (
                          <button
                            key={item.action}
                            type="button"
                            onClick={() => {
                              setTransformOpen(false);
                              setMenuOpen(false);
                              onCompanyBrainAction?.(item.action, block.content);
                            }}
                            className="flex w-full items-center gap-2 rounded-md px-2 py-1 text-[11px] text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition-colors font-medium"
                          >
                            <ItemIcon className="h-3 w-3" />
                            <span>{item.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Connect */}
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    onConnectBlock?.(block.id, block.content);
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 font-medium transition-colors"
                >
                  <Link2 className="h-3.5 w-3.5" /> Connect to Entity
                </button>

                {/* Comment */}
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    const cleanText = block.content.slice(0, 30);
                    window.alert(`Comment discussion thread for "${cleanText || "Block"}" will be available in future team releases.`);
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                >
                  <MessageSquare className="h-3.5 w-3.5 text-zinc-400" /> Comment
                </button>

                {/* Insert block below */}
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    onInsertBelow(index, "paragraph");
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                >
                  <Plus className="h-3.5 w-3.5 text-zinc-400" /> Insert block below
                </button>

                {/* Duplicate */}
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    onDuplicateBlock?.(index);
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                >
                  <CopyPlus className="h-3.5 w-3.5 text-zinc-400" /> Duplicate
                </button>

                <div className="my-1 h-px bg-zinc-200 dark:border-zinc-800" />

                {/* Move Up / Down */}
                <button
                  type="button"
                  onClick={() => {
                    onMoveUp(index);
                    setMenuOpen(false);
                  }}
                  disabled={index === 0}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-40 disabled:pointer-events-none"
                >
                  <ChevronUp className="h-3.5 w-3.5 text-zinc-400" /> Move up
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onMoveDown(index);
                    setMenuOpen(false);
                  }}
                  disabled={index === totalBlocks - 1}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-40 disabled:pointer-events-none"
                >
                  <ChevronDown className="h-3.5 w-3.5 text-zinc-400" /> Move down
                </button>

                {/* Copy link to block */}
                <button
                  type="button"
                  onClick={async () => {
                    setMenuOpen(false);
                    const url = `${window.location.origin}${window.location.pathname}#block-${block.id}`;
                    await navigator.clipboard.writeText(url);
                    setLinkCopied(true);
                    setTimeout(() => setLinkCopied(false), 2000);
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                >
                  {linkCopied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5 text-zinc-400" />}
                  <span>{linkCopied ? "Link copied" : "Copy link to block"}</span>
                </button>

                <div className="my-1 h-px bg-zinc-200 dark:bg-zinc-800" />

                {/* Delete */}
                <button
                  type="button"
                  onClick={() => {
                    onDeleteBlock(block.id);
                    setMenuOpen(false);
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Delete
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Block Content by Type */}
        <div className="flex-1 min-w-0">
          {/* PARAGRAPH */}
          {block.type === "paragraph" && (
            <div
              className="w-full leading-relaxed"
              onClick={(e) => {
                if (e.target === e.currentTarget && editableRef.current) {
                  focusBlockCaretEnd(editableRef.current);
                }
              }}
            >
              <p
                ref={setRef}
                contentEditable
                suppressContentEditableWarning
                onInput={handleInput}
                onFocus={handleFocus}
                onBlur={handleBlur}
                onKeyDown={(e) => onKeyDown(e, block, index)}
                data-placeholder={showPlaceholder ? "Type '/' for commands or '@' to link..." : ""}
                className={cn(
                  "outline-none text-sm text-zinc-800 dark:text-zinc-200 leading-relaxed whitespace-pre-wrap break-words inline",
                  !hasContent && "inline-block min-h-[1.5rem] w-full empty:before:content-[attr(data-placeholder)] empty:before:text-zinc-400 empty:before:pointer-events-none",
                  isAuthorHighlighted && hasContent && "bg-blue-500/30 dark:bg-blue-400/30 text-blue-950 dark:text-blue-50 [box-decoration-break:clone] [-webkit-box-decoration-break:clone]"
                )}
              >
                {block.content}
              </p>
              {renderBlame()}
            </div>
          )}

          {/* HEADING 1 */}
          {block.type === "heading_1" && (
            <div
              className="w-full leading-tight"
              onClick={(e) => {
                if (e.target === e.currentTarget && editableRef.current) {
                  focusBlockCaretEnd(editableRef.current);
                }
              }}
            >
              <h1
                ref={setRef}
                contentEditable
                suppressContentEditableWarning
                onInput={handleInput}
                onFocus={handleFocus}
                onBlur={handleBlur}
                onKeyDown={(e) => onKeyDown(e, block, index)}
                data-placeholder={showPlaceholder ? "Heading 1" : ""}
                className={cn(
                  "outline-none text-2xl font-bold tracking-tight text-zinc-950 dark:text-zinc-50 whitespace-pre-wrap break-words inline",
                  !hasContent && "inline-block min-h-[2rem] w-full empty:before:content-[attr(data-placeholder)] empty:before:text-zinc-400 empty:before:pointer-events-none",
                  isAuthorHighlighted && hasContent && "bg-blue-500/30 dark:bg-blue-400/30 text-blue-950 dark:text-blue-50 [box-decoration-break:clone] [-webkit-box-decoration-break:clone]"
                )}
              >
                {block.content}
              </h1>
              {renderBlame()}
            </div>
          )}

          {/* HEADING 2 */}
          {block.type === "heading_2" && (
            <div
              className="w-full leading-snug"
              onClick={(e) => {
                if (e.target === e.currentTarget && editableRef.current) {
                  focusBlockCaretEnd(editableRef.current);
                }
              }}
            >
              <h2
                ref={setRef}
                contentEditable
                suppressContentEditableWarning
                onInput={handleInput}
                onFocus={handleFocus}
                onBlur={handleBlur}
                onKeyDown={(e) => onKeyDown(e, block, index)}
                data-placeholder={showPlaceholder ? "Heading 2" : ""}
                className={cn(
                  "outline-none text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100 whitespace-pre-wrap break-words inline",
                  !hasContent && "inline-block min-h-[1.75rem] w-full empty:before:content-[attr(data-placeholder)] empty:before:text-zinc-400 empty:before:pointer-events-none",
                  isAuthorHighlighted && hasContent && "bg-blue-500/30 dark:bg-blue-400/30 text-blue-950 dark:text-blue-50 [box-decoration-break:clone] [-webkit-box-decoration-break:clone]"
                )}
              >
                {block.content}
              </h2>
              {renderBlame()}
            </div>
          )}

          {/* HEADING 3 */}
          {block.type === "heading_3" && (
            <div
              className="w-full leading-snug"
              onClick={(e) => {
                if (e.target === e.currentTarget && editableRef.current) {
                  focusBlockCaretEnd(editableRef.current);
                }
              }}
            >
              <h3
                ref={setRef}
                contentEditable
                suppressContentEditableWarning
                onInput={handleInput}
                onFocus={handleFocus}
                onBlur={handleBlur}
                onKeyDown={(e) => onKeyDown(e, block, index)}
                data-placeholder={showPlaceholder ? "Heading 3" : ""}
                className={cn(
                  "outline-none text-base font-semibold tracking-tight text-zinc-900 dark:text-zinc-200 whitespace-pre-wrap break-words inline",
                  !hasContent && "inline-block min-h-[1.5rem] w-full empty:before:content-[attr(data-placeholder)] empty:before:text-zinc-400 empty:before:pointer-events-none",
                  isAuthorHighlighted && hasContent && "bg-blue-500/30 dark:bg-blue-400/30 text-blue-950 dark:text-blue-50 [box-decoration-break:clone] [-webkit-box-decoration-break:clone]"
                )}
              >
                {block.content}
              </h3>
              {renderBlame()}
            </div>
          )}

          {/* BULLETED LIST */}
          {block.type === "bullet_list" && (
            <div className="flex items-start gap-2 w-full">
              <div className="flex items-center justify-center w-5 h-6 shrink-0 select-none">
                <span className="h-1.5 w-1.5 rounded-full bg-zinc-700 dark:bg-zinc-300" />
              </div>
              <div
                className="flex-1 min-w-0 leading-relaxed"
                onClick={(e) => {
                  if (e.target === e.currentTarget && editableRef.current) {
                    focusBlockCaretEnd(editableRef.current);
                  }
                }}
              >
                <div
                  ref={setRef}
                  contentEditable
                  suppressContentEditableWarning
                  onInput={handleInput}
                  onFocus={handleFocus}
                  onBlur={handleBlur}
                  onKeyDown={(e) => onKeyDown(e, block, index)}
                  data-placeholder={showPlaceholder ? "List item..." : ""}
                  className={cn(
                    "outline-none text-sm text-zinc-800 dark:text-zinc-200 leading-relaxed whitespace-pre-wrap break-words inline",
                    !hasContent && "inline-block min-h-[1.5rem] w-full empty:before:content-[attr(data-placeholder)] empty:before:text-zinc-400 empty:before:pointer-events-none",
                    isAuthorHighlighted && hasContent && "bg-blue-500/30 dark:bg-blue-400/30 text-blue-950 dark:text-blue-50 [box-decoration-break:clone] [-webkit-box-decoration-break:clone]"
                  )}
                >
                  {block.content}
                </div>
                {renderBlame()}
              </div>
            </div>
          )}

          {/* NUMBERED LIST */}
          {block.type === "numbered_list" && (
            <div className="flex items-start gap-2 w-full">
              <span className="text-sm font-medium text-zinc-500 dark:text-zinc-400 shrink-0 select-none w-5 text-center leading-relaxed tabular-nums">
                {listNumber ?? 1}.
              </span>
              <div
                className="flex-1 min-w-0 leading-relaxed"
                onClick={(e) => {
                  if (e.target === e.currentTarget && editableRef.current) {
                    focusBlockCaretEnd(editableRef.current);
                  }
                }}
              >
                <div
                  ref={setRef}
                  contentEditable
                  suppressContentEditableWarning
                  onInput={handleInput}
                  onFocus={handleFocus}
                  onBlur={handleBlur}
                  onKeyDown={(e) => onKeyDown(e, block, index)}
                  data-placeholder={showPlaceholder ? "List item..." : ""}
                  className={cn(
                    "outline-none text-sm text-zinc-800 dark:text-zinc-200 leading-relaxed whitespace-pre-wrap break-words inline",
                    !hasContent && "inline-block min-h-[1.5rem] w-full empty:before:content-[attr(data-placeholder)] empty:before:text-zinc-400 empty:before:pointer-events-none",
                    isAuthorHighlighted && hasContent && "bg-blue-500/30 dark:bg-blue-400/30 text-blue-950 dark:text-blue-50 [box-decoration-break:clone] [-webkit-box-decoration-break:clone]"
                  )}
                >
                  {block.content}
                </div>
                {renderBlame()}
              </div>
            </div>
          )}

          {/* CHECKLIST */}
          {block.type === "checklist" && (
            <div className="flex items-start gap-2 w-full">
              <div className="flex items-center justify-center w-5 h-6 shrink-0">
                <input
                  type="checkbox"
                  checked={block.properties?.checked || false}
                  onChange={(e) => onUpdateProperties(block.id, { checked: e.target.checked })}
                  className="h-4 w-4 rounded border-zinc-300 dark:border-zinc-700 text-blue-600 focus:ring-blue-500/20 cursor-pointer m-0"
                />
              </div>
              <div
                className="flex-1 min-w-0 leading-relaxed"
                onClick={(e) => {
                  if (e.target === e.currentTarget && editableRef.current) {
                    focusBlockCaretEnd(editableRef.current);
                  }
                }}
              >
                <div
                  ref={setRef}
                  contentEditable
                  suppressContentEditableWarning
                  onInput={handleInput}
                  onFocus={handleFocus}
                  onBlur={handleBlur}
                  onKeyDown={(e) => onKeyDown(e, block, index)}
                  data-placeholder={showPlaceholder ? "To-do..." : ""}
                  className={cn(
                    "outline-none text-sm text-zinc-800 dark:text-zinc-200 leading-relaxed whitespace-pre-wrap break-words inline",
                    !hasContent && "inline-block min-h-[1.5rem] w-full empty:before:content-[attr(data-placeholder)] empty:before:text-zinc-400 empty:before:pointer-events-none",
                    isAuthorHighlighted && hasContent && "bg-blue-500/30 dark:bg-blue-400/30 text-blue-950 dark:text-blue-50 [box-decoration-break:clone] [-webkit-box-decoration-break:clone]"
                  )}
                >
                  {block.content}
                </div>
                {renderBlame()}
              </div>
            </div>
          )}

          {/* TOGGLE */}
          {block.type === "toggle" && (
            <div className="flex flex-col my-1 w-full">
              <div className="flex items-start gap-1.5 w-full">
                <button
                  type="button"
                  onClick={() => onUpdateProperties(block.id, { isOpen: !block.properties?.isOpen })}
                  className="mt-0.5 p-0.5 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 transition-colors"
                >
                  <ChevronRight
                    className={cn(
                      "h-4 w-4 transition-transform duration-150",
                      block.properties?.isOpen && "rotate-90"
                    )}
                  />
                </button>
                <div
                  className="flex-1 min-w-0 leading-relaxed"
                  onClick={(e) => {
                    if (e.target === e.currentTarget && editableRef.current) {
                      focusBlockCaretEnd(editableRef.current);
                    }
                  }}
                >
                  <div
                    ref={setRef}
                    contentEditable
                    suppressContentEditableWarning
                    onInput={handleInput}
                    onFocus={handleFocus}
                    onBlur={handleBlur}
                    onKeyDown={(e) => onKeyDown(e, block, index)}
                    data-placeholder={showPlaceholder ? "Toggle header..." : ""}
                    className={cn(
                      "outline-none text-sm font-medium text-zinc-900 dark:text-zinc-100 leading-relaxed whitespace-pre-wrap break-words inline",
                      !hasContent && "inline-block min-h-[1.5rem] w-full empty:before:content-[attr(data-placeholder)] empty:before:text-zinc-400 empty:before:pointer-events-none",
                      isAuthorHighlighted && hasContent && "bg-blue-500/30 dark:bg-blue-400/30 text-blue-950 dark:text-blue-50 [box-decoration-break:clone] [-webkit-box-decoration-break:clone]"
                    )}
                  >
                    {block.content}
                  </div>
                  {renderBlame()}
                </div>
              </div>
              {block.properties?.isOpen && (
                <div className="pl-6 pt-1 text-xs text-zinc-500 border-l border-zinc-200 dark:border-zinc-800 ml-2 mt-1">
                  <p className="text-zinc-400 italic">Toggle container content. Press enter or add sub-blocks below.</p>
                </div>
              )}
            </div>
          )}

          {/* QUOTE */}
          {block.type === "quote" && (
            <blockquote
              className="border-l-2 border-zinc-400 dark:border-zinc-600 pl-3.5 py-0.5 italic leading-relaxed w-full"
              onClick={(e) => {
                if (e.target === e.currentTarget && editableRef.current) {
                  focusBlockCaretEnd(editableRef.current);
                }
              }}
            >
              <div
                ref={setRef}
                contentEditable
                suppressContentEditableWarning
                onInput={handleInput}
                onFocus={handleFocus}
                onBlur={handleBlur}
                onKeyDown={(e) => onKeyDown(e, block, index)}
                data-placeholder={showPlaceholder ? "Empty quote..." : ""}
                className={cn(
                  "outline-none text-sm text-zinc-600 dark:text-zinc-300 leading-relaxed whitespace-pre-wrap break-words inline",
                  !hasContent && "inline-block min-h-[1.5rem] w-full empty:before:content-[attr(data-placeholder)] empty:before:text-zinc-400 empty:before:pointer-events-none",
                  isAuthorHighlighted && hasContent && "bg-blue-500/30 dark:bg-blue-400/30 text-blue-950 dark:text-blue-50 [box-decoration-break:clone] [-webkit-box-decoration-break:clone]"
                )}
              >
                {block.content}
              </div>
              {renderBlame()}
            </blockquote>
          )}

          {/* DIVIDER */}
          {block.type === "divider" && (
            <div className="py-2.5">
              <hr className="border-t border-zinc-200 dark:border-zinc-800" />
            </div>
          )}

          {/* CODE BLOCK */}
          {block.type === "code" && (
            <div
              data-no-marquee="true"
              data-code-block="true"
              onMouseDown={(e) => {
                // Prevent page-level marquee drag from clearing text selection inside code
                e.stopPropagation();
              }}
              className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#18181b] overflow-hidden my-2 shadow-xs group/codecard select-text"
            >
              {/* Card Header */}
              <div className="flex items-center justify-between px-3.5 py-2 bg-zinc-100/75 dark:bg-[#121214] border-b border-zinc-200 dark:border-zinc-800/90 text-xs select-none">
                <div className="flex items-center gap-2 min-w-0 flex-wrap">
                  {isGitHubSnippet ? (
                    <>
                      {internalGitHubUrl ? (
                        <Link
                          href={internalGitHubUrl}
                          onClick={(e) => e.stopPropagation()}
                          className="group/link flex items-center gap-1.5 font-mono text-xs font-semibold text-zinc-900 dark:text-zinc-100 hover:text-blue-600 dark:hover:text-blue-400 transition-colors truncate cursor-pointer"
                          title={fullFilePath ? `Abrir ${fullFilePath} no GitHub` : "Abrir no GitHub"}
                        >
                          <FileCode className="h-4 w-4 text-blue-500 shrink-0 group-hover/link:text-blue-600 transition-colors" />
                          <span className="truncate group-hover/link:underline">
                            {fullFilePath}
                          </span>
                        </Link>
                      ) : (
                        <div className="flex items-center gap-1.5 font-mono text-xs font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                          <FileCode className="h-4 w-4 text-blue-500 shrink-0" />
                          <span className="truncate">
                            {fullFilePath}
                          </span>
                        </div>
                      )}
                      {codeStartLine !== undefined && (
                        <span className="text-[11px] font-mono text-zinc-500 dark:text-zinc-400 font-semibold">
                          (L{codeStartLine}{codeEndLine !== undefined && codeEndLine !== codeStartLine ? `–${codeEndLine}` : ""})
                        </span>
                      )}
                    </>
                  ) : (
                    <>
                      <CodeIcon className="h-3.5 w-3.5 text-zinc-500 shrink-0" />
                      <span className="font-mono text-[11px] uppercase tracking-wider text-zinc-700 dark:text-zinc-300 font-semibold">
                        {codeLanguage}
                      </span>
                    </>
                  )}
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-medium bg-zinc-200/80 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 shrink-0 uppercase">
                    {codeLanguage}
                  </span>
                  {renderBlame()}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={handleCopyCode}
                    className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-700/80 transition-colors shadow-2xs cursor-pointer select-none"
                    title="Copiar código"
                  >
                    {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3 opacity-70" />}
                    <span>{copied ? "Copiado" : "Copiar"}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsEditingCode(!isEditingCode)}
                    className="p-1 rounded text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-200/50 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                    title={isEditingCode ? "Ver formatado com sintaxe" : "Editar código"}
                  >
                    {isEditingCode ? <Eye className="h-3.5 w-3.5" /> : <Pencil className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </div>

              {/* Card Body */}
              {isEditingCode ? (
                <div className="p-3 bg-zinc-950 font-mono text-xs">
                  <textarea
                    ref={setRef as unknown as React.Ref<HTMLTextAreaElement>}
                    value={block.content}
                    onChange={(e) => onUpdateContent(block.id, e.target.value)}
                    onFocus={handleFocus}
                    onBlur={() => {
                      handleBlur();
                      if (block.content.trim()) setIsEditingCode(false);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Escape") {
                        setIsEditingCode(false);
                      }
                    }}
                    placeholder="// escreve o código aqui..."
                    rows={Math.max(4, block.content.split("\n").length)}
                    className="w-full bg-transparent text-zinc-100 outline-none resize-y font-mono text-xs leading-relaxed"
                    autoFocus
                  />
                  <div className="flex justify-end pt-2 border-t border-zinc-800">
                    <button
                      type="button"
                      onClick={() => setIsEditingCode(false)}
                      className="px-2.5 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-medium cursor-pointer transition-colors"
                    >
                      Concluir edição
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  ref={setRef as unknown as React.Ref<HTMLDivElement>}
                  onDoubleClick={() => setIsEditingCode(true)}
                  className="overflow-x-auto max-h-[640px] overflow-y-auto bg-zinc-50/50 dark:bg-[#1a1a1d] text-zinc-900 dark:text-zinc-100 font-mono text-[12px] leading-relaxed select-text py-1 outline-none"
                  title="Duplo clique para editar o código"
                >
                  <table className="w-full border-collapse select-text">
                    <tbody>
                      {tokenizedCodeLines.map((line, idx) => {
                        const currentLineNum =
                          isGitHubSnippet && typeof block.properties?.startLine === "number"
                            ? block.properties.startLine + idx
                            : idx + 1;
                        return (
                          <tr
                            key={idx}
                            className="hover:bg-zinc-200/50 dark:hover:bg-zinc-800/50 transition-colors group/row"
                          >
                            {/* Line Number Column */}
                            <td className="w-12 min-w-12 select-none pr-4 pl-3 text-right text-zinc-400 dark:text-zinc-600 text-[11px] align-top border-r border-zinc-200/80 dark:border-zinc-800/80 group-hover/row:text-zinc-700 dark:group-hover/row:text-zinc-400">
                              {currentLineNum}
                            </td>
                            {/* Syntax Highlighted Tokens */}
                            <td className="pl-4 pr-6 py-0.25 whitespace-pre font-mono text-[12px] tracking-normal select-text cursor-text">
                              {line.tokens.map((token, tIdx) => (
                                <span key={tIdx} className={cn(getTokenClasses(token.type), "select-text")}>
                                  {token.content}
                                </span>
                              ))}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* CALLOUT */}
          {block.type === "callout" && (
            <div className="flex items-start gap-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/40 p-3 my-1">
              <div className="flex items-center justify-center shrink-0 w-6 h-6 select-none">
                <EmojiPicker
                  currentEmoji={block.properties?.calloutIcon || "💡"}
                  onSelectEmoji={(emoji) => onUpdateProperties(block.id, { calloutIcon: emoji })}
                  className="flex items-center justify-center"
                  triggerClassName="h-6 w-6 text-base p-0 flex items-center justify-center rounded-md hover:bg-zinc-200/60 dark:hover:bg-zinc-700/60 transition-colors"
                />
              </div>
              <div
                ref={setRef}
                contentEditable
                suppressContentEditableWarning
                onInput={handleInput}
                onFocus={handleFocus}
                onBlur={handleBlur}
                onKeyDown={(e) => onKeyDown(e, block, index)}
                data-placeholder={showPlaceholder ? "Type callout context..." : ""}
                className="flex-1 outline-none min-h-[1.5rem] text-sm text-zinc-800 dark:text-zinc-200 leading-6 empty:before:content-[attr(data-placeholder)] empty:before:text-zinc-400 empty:before:pointer-events-none whitespace-pre-wrap break-words"
              >
                {block.content}
              </div>
            </div>
          )}

          {/* IMAGE */}
          {block.type === "image" && (
            <ImageBlockContent
              block={block}
              blockAlign={blockAlign}
              filePreview={filePreview}
              onUpdateProperties={onUpdateProperties}
              onOpenFilePicker={onOpenFilePicker}
              onOpenLightbox={(src) => {
                setLightboxSrc(src);
                setIsLightboxOpen(true);
              }}
            />
          )}

          {/* VIDEO */}
          {block.type === "video" && (
            <div className="my-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 p-2">
              {block.properties?.fileStatus === "unavailable" ? (
                <div className="p-4 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 text-xs text-amber-800 dark:text-amber-300 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                    <span>External video unavailable — reconnect Google Drive to access.</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => openSettings("integrations")}
                    className="px-2.5 py-1 rounded-md bg-amber-600 hover:bg-amber-500 text-white font-medium text-[11px] transition-colors"
                  >
                    Reconnect
                  </button>
                </div>
              ) : block.properties?.mediaUrl ? (
                <div className="space-y-1.5">
                  <div className="aspect-video w-full rounded-lg overflow-hidden bg-black flex items-center justify-center">
                    <iframe
                      src={block.properties.mediaUrl.replace("watch?v=", "embed/")}
                      className="w-full h-full border-0"
                      allowFullScreen
                    />
                  </div>
                  <input
                    type="text"
                    value={block.properties.caption || ""}
                    onChange={(e) => onUpdateProperties(block.id, { caption: e.target.value })}
                    placeholder="Add a caption..."
                    className="w-full text-center text-xs text-zinc-400 bg-transparent border-none outline-none focus:text-zinc-700 dark:focus:text-zinc-200"
                  />
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center p-6 gap-3 text-zinc-400">
                  <VideoIcon className="h-8 w-8 text-zinc-300 dark:text-zinc-600" />
                  <div className="flex flex-col sm:flex-row items-center gap-2 max-w-md w-full">
                    {onOpenFilePicker && (
                      <button
                        type="button"
                        onClick={() => onOpenFilePicker(block.id, "video")}
                        className="w-full sm:w-auto px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium flex items-center justify-center gap-1.5 transition-colors shrink-0"
                      >
                        <Upload className="h-3.5 w-3.5" /> Attach Video
                      </button>
                    )}
                    <input
                      type="url"
                      placeholder="Or paste video link (YouTube / Google Drive)..."
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          const val = (e.target as HTMLInputElement).value.trim();
                          if (val) onUpdateProperties(block.id, { mediaUrl: val });
                        }
                      }}
                      className="flex-1 px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs text-zinc-800 dark:text-zinc-200 outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* AUDIO */}
          {block.type === "audio" && (
            <div className="my-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 p-3">
              {block.properties?.mediaUrl ? (
                <div className="flex items-center gap-3">
                  <Music className="h-5 w-5 text-indigo-500 shrink-0" />
                  <audio controls src={block.properties.mediaUrl} className="w-full h-8" />
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <Music className="h-5 w-5 text-zinc-400 shrink-0" />
                  {onOpenFilePicker && (
                    <button
                      type="button"
                      onClick={() => onOpenFilePicker(block.id, "audio")}
                      className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium flex items-center gap-1.5 transition-colors shrink-0"
                    >
                      <Upload className="h-3 w-3" /> Attach Audio
                    </button>
                  )}
                  <input
                    type="url"
                    placeholder="Or paste audio link (https://...mp3)..."
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        const val = (e.target as HTMLInputElement).value.trim();
                        if (val) onUpdateProperties(block.id, { mediaUrl: val });
                      }
                    }}
                    className="flex-1 px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs text-zinc-800 dark:text-zinc-200 outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              )}
            </div>
          )}

          {/* FILE / DOCUMENT */}
          {block.type === "file" && (
            <div className="my-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 p-3">
              {block.properties?.fileStatus === "unavailable" ? (
                <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 text-xs text-amber-800 dark:text-amber-300 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                    <span>External file unavailable — reconnect Google Drive to access.</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => openSettings("integrations")}
                    className="px-2.5 py-1 rounded-md bg-amber-600 hover:bg-amber-500 text-white font-medium text-[11px] transition-colors"
                  >
                    Reconnect
                  </button>
                </div>
              ) : block.properties?.mediaUrl || block.properties?.fileName ? (
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-9 w-9 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                      {block.properties?.mimeType?.includes("sheet") || block.properties?.fileName?.endsWith(".xlsx") || block.properties?.fileName?.endsWith(".csv") ? (
                        <FileSpreadsheet className="h-5 w-5 text-teal-500" />
                      ) : block.properties?.mimeType === "application/pdf" || block.properties?.fileName?.endsWith(".pdf") ? (
                        <FileText className="h-5 w-5 text-rose-500" />
                      ) : (
                        <FileText className="h-5 w-5 text-indigo-500" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 truncate">
                          {block.properties?.fileName || "Attachment document"}
                        </p>
                        {block.properties?.storageProvider === "google_drive" && (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400 shrink-0">
                            <Cloud className="h-2.5 w-2.5" /> Drive
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-zinc-400">{block.properties?.fileSize || "File"}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {(block.properties?.mimeType === "application/pdf" || block.properties?.fileName?.endsWith(".pdf")) && block.properties?.mediaUrl && (
                      <button
                        type="button"
                        onClick={() => setIsPdfOpen(true)}
                        className="px-2.5 py-1 rounded-md text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition-colors"
                      >
                        Preview PDF
                      </button>
                    )}
                    {block.properties?.mediaUrl && (
                      <a
                        href={block.properties.mediaUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="px-2.5 py-1 rounded-md text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors flex items-center gap-1"
                      >
                        <ExternalLink className="h-3 w-3" /> Open
                      </a>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex flex-col sm:flex-row items-center justify-between p-4 gap-3 text-zinc-400">
                  <div className="flex items-center gap-2.5">
                    <FileText className="h-6 w-6 text-zinc-300 dark:text-zinc-600" />
                    <span className="text-xs text-zinc-500">No document attached yet</span>
                  </div>
                  {onOpenFilePicker && (
                    <button
                      type="button"
                      onClick={() => onOpenFilePicker(block.id, "all")}
                      className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium flex items-center gap-1.5 transition-colors"
                    >
                      <Upload className="h-3 w-3" /> Attach File or Drive Reference
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* BOOKMARK */}
          {block.type === "bookmark" && (
            <div className="my-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 p-3 hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1 min-w-0 flex-1">
                  <input
                    type="text"
                    value={block.properties?.bookmarkTitle || block.content || "Web Bookmark"}
                    onChange={(e) => onUpdateProperties(block.id, { bookmarkTitle: e.target.value })}
                    placeholder="Bookmark title..."
                    className="w-full text-xs font-semibold text-zinc-800 dark:text-zinc-200 bg-transparent border-none outline-none p-0"
                  />
                  <input
                    type="text"
                    value={block.properties?.bookmarkDescription || ""}
                    onChange={(e) => onUpdateProperties(block.id, { bookmarkDescription: e.target.value })}
                    placeholder="Brief description..."
                    className="w-full text-[11px] text-zinc-400 bg-transparent border-none outline-none p-0"
                  />
                  <div className="flex items-center gap-1.5 pt-1">
                    <Bookmark className="h-3 w-3 text-zinc-400 shrink-0" />
                    <input
                      type="url"
                      value={block.properties?.bookmarkUrl || ""}
                      onChange={(e) => onUpdateProperties(block.id, { bookmarkUrl: e.target.value })}
                      placeholder="https://example.com"
                      className="text-[11px] text-indigo-600 dark:text-indigo-400 bg-transparent border-none outline-none p-0 flex-1 truncate"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TABLE */}
          {block.type === "table" && (
            <TableBlockContent
              block={block}
              onUpdateProperties={onUpdateProperties}
            />
          )}

          {/* COLUMNS (SIDE BY SIDE) */}
          {block.type === "columns" && (
            <ColumnsBlockContent
              block={block}
              onUpdateProperties={onUpdateProperties}
            />
          )}

          {/* BOARD (KANBAN) */}
          {block.type === "board" && (() => {
            const boardData = block.properties?.boardData || {
              columns: [
                { id: "col-1", title: "To Do", cards: [{ id: "c-1", text: "First card" }] },
                { id: "col-2", title: "In Progress", cards: [] },
                { id: "col-3", title: "Done", cards: [] },
              ],
            };
            const boardTitle = (block.properties?.boardTitle as string) || "Board";

            const updateBoardTitle = (title: string) => {
              onUpdateProperties(block.id, { boardTitle: title });
            };

            const updateColumnTitle = (colId: string, title: string) => {
              const nextCols = boardData.columns.map((c) => {
                if (c.id !== colId) return c;
                return { ...c, title };
              });
              onUpdateProperties(block.id, { boardData: { columns: nextCols } });
            };

            const addColumn = () => {
              const nextCols = [
                ...boardData.columns,
                { id: `col-${crypto.randomUUID()}`, title: "New Column", cards: [] },
              ];
              onUpdateProperties(block.id, { boardData: { columns: nextCols } });
            };

            const deleteColumn = (colId: string) => {
              if (boardData.columns.length <= 1) return;
              const nextCols = boardData.columns.filter((c) => c.id !== colId);
              onUpdateProperties(block.id, { boardData: { columns: nextCols } });
            };

            const addCard = (colId: string) => {
              const nextCols = boardData.columns.map((c) => {
                if (c.id !== colId) return c;
                return {
                  ...c,
                  cards: [...c.cards, { id: crypto.randomUUID(), text: "New card" }],
                };
              });
              onUpdateProperties(block.id, { boardData: { columns: nextCols } });
            };

            const updateCardText = (colId: string, cardId: string, text: string) => {
              const nextCols = boardData.columns.map((c) => {
                if (c.id !== colId) return c;
                return {
                  ...c,
                  cards: c.cards.map((cd) => (cd.id === cardId ? { ...cd, text } : cd)),
                };
              });
              onUpdateProperties(block.id, { boardData: { columns: nextCols } });
            };

            const deleteCard = (colId: string, cardId: string) => {
              const nextCols = boardData.columns.map((c) => {
                if (c.id !== colId) return c;
                return {
                  ...c,
                  cards: c.cards.filter((cd) => cd.id !== cardId),
                };
              });
              onUpdateProperties(block.id, { boardData: { columns: nextCols } });
            };

            return (
              <div className="my-2 p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-900/40 space-y-3">
                {/* Board Header: Title, Blame & Actions */}
                <div className="flex items-center justify-between pb-2 border-b border-zinc-200/60 dark:border-zinc-800 text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <Kanban className="h-4 w-4 text-indigo-500 shrink-0" />
                    <input
                      type="text"
                      value={boardTitle}
                      onChange={(e) => updateBoardTitle(e.target.value)}
                      placeholder="Board Title..."
                      className={cn(
                        "bg-transparent border-none outline-none font-bold text-xs truncate transition-colors",
                        isSelected
                          ? "text-blue-600 dark:text-blue-400 font-bold bg-blue-50/80 dark:bg-blue-950/60 px-1.5 py-0.5 rounded ring-1 ring-blue-500/30"
                          : "text-zinc-800 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 px-1 py-0.5 rounded"
                      )}
                    />
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {renderBlame(true)}
                  </div>
                </div>

                {/* Columns Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {boardData.columns.map((col) => (
                    <div key={col.id} className="rounded-lg bg-white dark:bg-zinc-800/60 p-2.5 shadow-2xs border border-zinc-200/60 dark:border-zinc-700/60 flex flex-col gap-2 group/col">
                      <div className="flex items-center justify-between gap-1 text-xs font-bold text-zinc-700 dark:text-zinc-300">
                        <input
                          type="text"
                          value={col.title}
                          onChange={(e) => updateColumnTitle(col.id, e.target.value)}
                          placeholder="Column..."
                          className="bg-transparent border-none outline-none font-semibold text-xs text-zinc-800 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700/50 rounded px-1 py-0.5 w-full focus:bg-white dark:focus:bg-zinc-700 focus:ring-1 focus:ring-blue-500/50 transition-colors"
                        />
                        <div className="flex items-center gap-1 shrink-0">
                          <span className="text-[10px] text-zinc-400 font-normal px-1">{col.cards.length}</span>
                          {boardData.columns.length > 1 && (
                            <button
                              type="button"
                              onClick={() => deleteColumn(col.id)}
                              className="text-zinc-400 hover:text-red-500 opacity-0 group-hover/col:opacity-100 text-xs px-1"
                              title="Delete column"
                            >
                              ×
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="space-y-1.5 min-h-[4rem]">
                        {col.cards.map((card) => (
                          <div key={card.id} className="flex items-center justify-between p-2 rounded-md bg-zinc-50 dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-700 text-xs group/card">
                            <input
                              type="text"
                              value={card.text}
                              onChange={(e) => updateCardText(col.id, card.id, e.target.value)}
                              className="bg-transparent border-none outline-none w-full text-zinc-800 dark:text-zinc-200"
                            />
                            <button
                              type="button"
                              onClick={() => deleteCard(col.id, card.id)}
                              className="text-zinc-400 hover:text-red-500 opacity-0 group-hover/card:opacity-100 ml-1 text-xs"
                            >
                              ×
                            </button>
                          </div>
                        ))}
                      </div>
                      <button
                        type="button"
                        onClick={() => addCard(col.id)}
                        className="text-[11px] text-zinc-500 hover:text-indigo-600 text-left pt-1"
                      >
                        + Add card
                      </button>
                    </div>
                  ))}
                </div>

                {/* Footer Controls: Add column & Insert line below */}
                <div className="flex items-center justify-between pt-1 text-xs text-zinc-400">
                  <button
                    type="button"
                    onClick={addColumn}
                    className="text-[11px] text-zinc-500 hover:text-indigo-600 transition-colors px-1 py-0.5 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800"
                  >
                    + Add column
                  </button>
                  <button
                    type="button"
                    onClick={() => onInsertBelow(index, "paragraph")}
                    className="text-[11px] text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 flex items-center gap-1 transition-colors px-2 py-0.5 rounded border border-dashed border-zinc-300 dark:border-zinc-700 hover:border-zinc-400"
                    title="Add a new text line below this board"
                  >
                    + Insert line below
                  </button>
                </div>
              </div>
            );
          })()}

          {/* GALLERY */}
          {block.type === "gallery" && (() => {
            const galleryData = block.properties?.galleryData || {
              items: [
                { id: "g-1", title: "Project Brief", tag: "Design" },
                { id: "g-2", title: "Architecture Spec", tag: "Engineering" },
                { id: "g-3", title: "Customer Interviews", tag: "Research" },
              ],
            };

            const addItem = () => {
              onUpdateProperties(block.id, {
                galleryData: {
                  items: [...galleryData.items, { id: crypto.randomUUID(), title: "New Item", tag: "General" }],
                },
              });
            };

            const updateItem = (id: string, title: string) => {
              onUpdateProperties(block.id, {
                galleryData: {
                  items: galleryData.items.map((it) => (it.id === id ? { ...it, title } : it)),
                },
              });
            };

            return (
              <div className="my-2 p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {galleryData.items.map((item) => (
                    <div key={item.id} className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 p-3 shadow-2xs flex flex-col justify-between h-28">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] uppercase font-semibold text-indigo-500">{item.tag || "Item"}</span>
                      </div>
                      <input
                        type="text"
                        value={item.title}
                        onChange={(e) => updateItem(item.id, e.target.value)}
                        className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 bg-transparent border-none outline-none w-full"
                      />
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={addItem}
                  className="mt-3 text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
                >
                  + Add gallery item
                </button>
              </div>
            );
          })()}

          {/* LIST VIEW */}
          {block.type === "list" && (() => {
            const listData = block.properties?.listData || {
              items: [
                { id: "l-1", title: "Launch MVP", status: "Active" },
                { id: "l-2", title: "Verify Stripe Webhook", status: "Done" },
              ],
            };

            const addListItem = () => {
              onUpdateProperties(block.id, {
                listData: {
                  items: [...listData.items, { id: crypto.randomUUID(), title: "New Item", status: "Pending" }],
                },
              });
            };

            const updateListItem = (id: string, title: string) => {
              onUpdateProperties(block.id, {
                listData: {
                  items: listData.items.map((it) => (it.id === id ? { ...it, title } : it)),
                },
              });
            };

            return (
              <div className="my-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 p-2 shadow-2xs">
                <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {listData.items.map((it) => (
                    <div key={it.id} className="flex items-center justify-between py-2 px-2 text-xs">
                      <input
                        type="text"
                        value={it.title}
                        onChange={(e) => updateListItem(it.id, e.target.value)}
                        className="bg-transparent border-none outline-none flex-1 text-zinc-800 dark:text-zinc-200 font-medium"
                      />
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                        {it.status || "Status"}
                      </span>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={addListItem}
                  className="pt-2 px-2 text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
                >
                  + Add item
                </button>
              </div>
            );
          })()}

          {/* CALENDAR */}
          {block.type === "calendar" && (
            <div className="space-y-1">
              <PageCalendarBlock
                blockId={block.id}
                properties={block.properties}
                onUpdateProperties={onUpdateProperties}
                authorBlame={renderBlame(true)}
              />
              <div className="flex justify-end pt-1">
                <button
                  type="button"
                  onClick={() => onInsertBelow(index, "paragraph")}
                  className="text-[11px] text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 flex items-center gap-1 transition-colors px-2 py-0.5 rounded border border-dashed border-zinc-300 dark:border-zinc-700 hover:border-zinc-400"
                  title="Add a new text line below this calendar"
                >
                  + Insert line below
                </button>
              </div>
            </div>
          )}

          {/* EQUATION */}
          {block.type === "equation" && (
            <div className="my-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/60 p-3 text-center">
              <div className="font-mono text-base font-semibold text-indigo-600 dark:text-indigo-400 py-2">
                {block.properties?.equationFormula || "f(x) = a x^2 + b x + c"}
              </div>
              <input
                type="text"
                value={block.properties?.equationFormula || ""}
                onChange={(e) => onUpdateProperties(block.id, { equationFormula: e.target.value })}
                placeholder="Type equation (e.g. E = mc^2)..."
                className="w-full text-center text-xs text-zinc-400 bg-transparent border-t border-zinc-200 dark:border-zinc-800 pt-2 outline-none focus:text-zinc-700 dark:focus:text-zinc-300 font-mono"
              />
            </div>
          )}

          {/* TABLE OF CONTENTS */}
          {block.type === "table_of_contents" && (() => {
            const headings = allBlocks.filter((b) =>
              b.type === "heading_1" || b.type === "heading_2" || b.type === "heading_3"
            );

            return (
              <div className="my-2 p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50">
                <div className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <ListTree className="h-3.5 w-3.5 text-indigo-500" /> Table of Contents
                </div>
                {headings.length === 0 ? (
                  <p className="text-xs text-zinc-400 italic">No headings yet. Add H1, H2, or H3 blocks to see outline.</p>
                ) : (
                  <div className="space-y-1">
                    {headings.map((h) => {
                      const indent =
                        h.type === "heading_1"
                          ? "pl-0 font-medium"
                          : h.type === "heading_2"
                          ? "pl-3 text-zinc-600 dark:text-zinc-400"
                          : "pl-6 text-zinc-500";
                      return (
                        <a
                          key={h.id}
                          href={`#block-${h.id}`}
                          className={cn("block text-xs hover:text-indigo-600 dark:hover:text-indigo-400 hover:underline", indent)}
                        >
                          {h.content || "Untitled Section"}
                        </a>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })()}

          {/* BREADCRUMB */}
          {block.type === "breadcrumb" && (
            <div className="my-1.5 flex items-center gap-1.5 text-xs text-zinc-400 select-none py-1">
              <FolderTree className="h-3.5 w-3.5 text-zinc-400" />
              <span className="hover:text-zinc-600 dark:hover:text-zinc-200 cursor-pointer">Workspace</span>
              <span>/</span>
              <span className="font-medium text-zinc-800 dark:text-zinc-200">{pageTitle || "Current Page"}</span>
            </div>
          )}

          {/* BUTTON */}
          {block.type === "button" && (
            <div className="my-2 flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  if (block.properties?.buttonData?.url) {
                    window.open(block.properties.buttonData.url, "_blank");
                  }
                }}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white text-xs font-semibold shadow-sm transition-all"
              >
                {block.properties?.buttonData?.label || block.content || "Button Action"}
              </button>
              <input
                type="text"
                value={block.properties?.buttonData?.label || block.content || ""}
                onChange={(e) => {
                  onUpdateProperties(block.id, {
                    buttonData: {
                      label: e.target.value,
                      url: block.properties?.buttonData?.url || "",
                    },
                  });
                  onUpdateContent(block.id, e.target.value);
                }}
                placeholder="Label..."
                className="text-xs text-zinc-500 border border-zinc-200 dark:border-zinc-800 rounded-lg px-2 py-1 bg-transparent"
              />
              <input
                type="url"
                value={block.properties?.buttonData?.url || ""}
                onChange={(e) => {
                  onUpdateProperties(block.id, {
                    buttonData: {
                      label: block.properties?.buttonData?.label || block.content || "Button Action",
                      url: e.target.value,
                    },
                  });
                }}
                placeholder="https://..."
                className="text-xs text-zinc-500 border border-zinc-200 dark:border-zinc-800 rounded-lg px-2 py-1 bg-transparent w-48"
              />
            </div>
          )}

          {/* GITHUB REFERENCE BLOCK */}
          {block.type === "github" && (() => {
            const gh = block.properties?.githubData || {
              type: "repo",
              title: block.content || "GitHub Reference",
              url: "https://github.com",
              state: "open",
              repoFullName: "organization/repository",
            };

            return (
              <div className="my-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900/50 p-3.5 hover:border-zinc-300 dark:hover:border-zinc-700 transition-all shadow-2xs">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 shadow-2xs shrink-0">
                      <Github className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <a
                          href={gh.url}
                          target="_blank"
                          rel="noreferrer"
                          className="font-semibold text-xs text-zinc-900 dark:text-zinc-100 hover:text-blue-500 transition-colors truncate"
                        >
                          {gh.title}
                        </a>
                        {gh.number && (
                          <span className="text-[11px] font-mono text-zinc-500 dark:text-zinc-400">
                            #{gh.number}
                          </span>
                        )}
                        {gh.state && (
                          <span
                            className={cn(
                              "text-[10px] font-medium px-2 py-0.5 rounded-full capitalize border",
                              gh.state === "open"
                                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                                : gh.state === "merged"
                                ? "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20"
                                : "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20"
                            )}
                          >
                            {gh.state}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                        {gh.repoFullName && <span className="font-mono">{gh.repoFullName}</span>}
                        {gh.authorLogin && (
                          <>
                            <span>•</span>
                            <span>by {gh.authorLogin}</span>
                          </>
                        )}
                        {gh.updatedAt && (
                          <>
                            <span>•</span>
                            <span>{formatRelativeTime(gh.updatedAt)}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <a
                      href={gh.url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-800 text-[11px] font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors"
                    >
                      <span>GitHub</span>
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Inline Entity Connection Badges */}
          {blockConnections.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 mt-1.5 pt-0.5 select-none">
              {blockConnections.map((conn) => {
                const relType = (conn.metadata?.relation_type as RelationType) || "related_to";
                const relLabel = RELATION_LABELS[relType] || "Related to";

                return (
                  <button
                    key={conn.id}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onClickConnection?.(conn);
                    }}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium border border-indigo-200/80 dark:border-indigo-800/80 bg-indigo-50/60 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors shadow-2xs group"
                    title={`Connected to ${conn.target_type}: ${conn.target_title} (${relLabel})`}
                  >
                    <Sparkles className="h-2.5 w-2.5 text-indigo-500 shrink-0" />
                    <span className="capitalize text-[10px] text-zinc-500 dark:text-zinc-400 font-normal">
                      {conn.target_type} ·
                    </span>
                    <span className="truncate max-w-[180px] font-medium">{conn.target_title}</span>
                    <span className="text-[9px] px-1 py-0.2 rounded bg-indigo-100/80 dark:bg-indigo-900/60 text-indigo-800 dark:text-indigo-200 font-normal">
                      {relLabel}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Drop indicator: AFTER */}
      {dropIndicatorPosition === "after" && (
        <div className="h-0.5 w-full bg-blue-500 rounded-full mt-1 shadow-xs pointer-events-none animate-in fade-in duration-100" />
      )}

      {/* PDF Modal */}
      {isPdfOpen && block.properties?.mediaUrl && (
        <PdfViewerModal
          isOpen={true}
          onClose={() => setIsPdfOpen(false)}
          pdfUrl={block.properties.mediaUrl}
          title={block.properties.fileName || "PDF Document"}
          downloadUrl={block.properties.mediaUrl}
        />
      )}

      {/* Image Lightbox */}
      {isLightboxOpen && (lightboxSrc || block.properties?.mediaUrl) && (
        <div
          onClick={() => {
            setIsLightboxOpen(false);
            setLightboxSrc(null);
          }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md cursor-zoom-out animate-in fade-in duration-150"
        >
          <div className="relative max-w-5xl max-h-[90vh] flex flex-col items-center">
            <img
              src={lightboxSrc || block.properties?.mediaUrl || ""}
              alt={block.properties?.caption || "Full size preview"}
              className="max-w-full max-h-[85vh] object-contain rounded-xl shadow-2xl"
            />
            {block.properties?.caption && (
              <p className="mt-3 text-xs text-white/80 bg-black/50 px-3 py-1.5 rounded-lg">
                {block.properties.caption}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
