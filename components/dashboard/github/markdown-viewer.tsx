"use client";

// ==============================================================================
// BusinessBrain: Rich Markdown Document Viewer
// Renders GitHub-flavored Markdown documents (.md, .markdown, .mdx) with:
// - Hierarchical headings with anchors and typography
// - Syntax-highlighted fenced code blocks with language badge & copy button
// - GitHub-style alerts (> [!NOTE], > [!TIP], > [!WARNING], > [!IMPORTANT], > [!CAUTION])
// - Tables, Task lists, Bullet lists, Numbered lists
// - Inline formatting (bold, italic, code, links, strikethrough, images)
// - Text selection integration for workspace discussions
// - 100% Type-safe React nodes (Zero unsafe innerHTML)
// ==============================================================================

import * as React from "react";
import {
  Check,
  Copy,
  ExternalLink,
  Info,
  Lightbulb,
  AlertTriangle,
  AlertOctagon,
  FileCode,
  CheckSquare,
  Square,
  MessageSquare,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/lib/i18n";
import { detectLanguageFromPath, tokenizeCodeToLines, getTokenClasses } from "@/lib/code-viewer/syntax";

export interface MarkdownViewerProps {
  content: string;
  filePath: string;
  onDiscussSelection?: (selection: {
    filePath: string;
    selectedCode: string;
    startLine?: number;
    endLine?: number;
  }) => void;
}

// ------------------------------------------------------------------------------
// Inline Markdown Tokenizer
// Safely parses bold, italic, inline code, links, images, and strikethrough
// ------------------------------------------------------------------------------
interface InlineToken {
  type: "text" | "bold" | "italic" | "code" | "link" | "image" | "strike";
  raw: string;
  text?: string;
  href?: string;
  src?: string;
  alt?: string;
}

function parseInlineTokens(text: string): React.ReactNode[] {
  if (!text) return [];

  // Match: images ![](), links [](), code ``, bold ** or __, strike ~~, italic * or _
  const regex = /(!\[([^\]]*)\]\(([^)]+)\))|(\[([^\]]+)\]\(([^)]+)\))|(`([^`]+)`)|(\*\*([^*]+)\*\*|__([^_]+)__)|(~~([^~]+)~~)|(\*([^*]+)\*|_([^_]+)_)/g;

  const elements: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let keyIndex = 0;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      elements.push(text.substring(lastIndex, match.index));
    }

    const [
      fullMatch,
      imageMatch, imgAlt, imgSrc,
      linkMatch, linkText, linkHref,
      codeMatch, codeContent,
      boldMatch, boldText1, boldText2,
      strikeMatch, strikeText,
      italicMatch, italicText1, italicText2,
    ] = match;

    if (imageMatch) {
      elements.push(
        <img
          key={`img-${keyIndex++}`}
          src={imgSrc}
          alt={imgAlt || "Image"}
          className="inline-block max-w-full my-2 rounded-lg border border-border shadow-2xs"
          loading="lazy"
        />
      );
    } else if (linkMatch) {
      const isExternal = linkHref.startsWith("http://") || linkHref.startsWith("https://");
      elements.push(
        <a
          key={`link-${keyIndex++}`}
          href={linkHref}
          target={isExternal ? "_blank" : undefined}
          rel={isExternal ? "noopener noreferrer" : undefined}
          className="text-blue-600 dark:text-blue-400 font-medium hover:underline inline-flex items-center gap-0.5"
        >
          <span>{linkText}</span>
          {isExternal && <ExternalLink className="h-2.5 w-2.5 opacity-60 inline" />}
        </a>
      );
    } else if (codeMatch) {
      elements.push(
        <code
          key={`code-${keyIndex++}`}
          className="px-1.5 py-0.5 rounded text-[12px] font-mono font-medium bg-zinc-100 dark:bg-zinc-800 text-pink-600 dark:text-pink-400 border border-zinc-200/80 dark:border-zinc-700/80"
        >
          {codeContent}
        </code>
      );
    } else if (boldMatch) {
      elements.push(
        <strong key={`bold-${keyIndex++}`} className="font-semibold text-foreground">
          {boldText1 || boldText2}
        </strong>
      );
    } else if (strikeMatch) {
      elements.push(
        <del key={`del-${keyIndex++}`} className="line-through text-muted-foreground">
          {strikeText}
        </del>
      );
    } else if (italicMatch) {
      elements.push(
        <em key={`em-${keyIndex++}`} className="italic">
          {italicText1 || italicText2}
        </em>
      );
    }

    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    elements.push(text.substring(lastIndex));
  }

  return elements;
}

// ------------------------------------------------------------------------------
// Fenced Code Block with Syntax Highlighting & Copy
// ------------------------------------------------------------------------------
function MarkdownCodeBlock({ code, lang }: { code: string; lang: string }) {
  const { locale } = useLanguage();
  const isPt = locale === "pt";
  const [copied, setCopied] = React.useState(false);
  const detectedLang = lang.trim().toLowerCase() || "plaintext";

  const lines = React.useMemo(() => {
    return tokenizeCodeToLines(code, detectedLang);
  }, [code, detectedLang]);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative my-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-950 text-zinc-100 shadow-xs overflow-hidden group">
      {/* Code Header */}
      <div className="flex items-center justify-between px-3.5 py-1.5 bg-zinc-900/90 border-b border-zinc-800 text-xs">
        <span className="font-mono text-[11px] font-medium text-zinc-400 uppercase">
          {detectedLang}
        </span>
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1 px-2 py-0.5 rounded text-[11px] text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors cursor-pointer"
          title={isPt ? "Copiar código" : "Copy code"}
        >
          {copied ? (
            <>
              <Check className="h-3 w-3 text-emerald-400" />
              <span className="text-emerald-400 font-semibold">{isPt ? "Copiado!" : "Copied!"}</span>
            </>
          ) : (
            <>
              <Copy className="h-3 w-3" />
              <span>{isPt ? "Copiar" : "Copy"}</span>
            </>
          )}
        </button>
      </div>

      {/* Code Content */}
      <div className="p-3.5 overflow-x-auto font-mono text-[12px] leading-relaxed select-text">
        <table className="w-full border-collapse">
          <tbody>
            {lines.map((line) => (
              <tr key={line.lineNumber}>
                <td className="w-8 pr-3 text-right select-none text-[11px] text-zinc-600 font-mono">
                  {line.lineNumber}
                </td>
                <td className="pl-3 whitespace-pre text-zinc-100">
                  {line.tokens.map((token, tIdx) => (
                    <span key={tIdx} className={getTokenClasses(token.type)}>
                      {token.content}
                    </span>
                  ))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------------------
// Markdown Table Renderer
// ------------------------------------------------------------------------------
function MarkdownTable({ rows }: { rows: string[] }) {
  if (rows.length < 2) return null;

  const parseRow = (line: string): string[] => {
    return line
      .replace(/^\|/, "")
      .replace(/\|$/, "")
      .split("|")
      .map((c) => c.trim());
  };

  const headerCells = parseRow(rows[0]);
  const bodyRows = rows.slice(2).map(parseRow);

  return (
    <div className="my-4 overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-2xs">
      <table className="w-full border-collapse text-xs text-left">
        <thead className="bg-zinc-100/80 dark:bg-zinc-800/60 border-b border-zinc-200 dark:border-zinc-800 font-semibold text-foreground">
          <tr>
            {headerCells.map((cell, idx) => (
              <th key={idx} className="px-3.5 py-2.5">
                {parseInlineTokens(cell)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
          {bodyRows.map((row, rIdx) => (
            <tr
              key={rIdx}
              className="hover:bg-zinc-50 dark:hover:bg-zinc-900/50 transition-colors"
            >
              {row.map((cell, cIdx) => (
                <td key={cIdx} className="px-3.5 py-2 text-zinc-700 dark:text-zinc-300">
                  {parseInlineTokens(cell)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ------------------------------------------------------------------------------
// GitHub-Style Alert / Callout
// ------------------------------------------------------------------------------
function MarkdownAlert({
  type,
  lines,
}: {
  type: "NOTE" | "TIP" | "IMPORTANT" | "WARNING" | "CAUTION";
  lines: string[];
}) {
  const configs = {
    NOTE: {
      icon: Info,
      title: "Note",
      containerClass: "border-blue-500/40 bg-blue-500/10 text-blue-900 dark:text-blue-100",
      iconClass: "text-blue-600 dark:text-blue-400",
    },
    TIP: {
      icon: Lightbulb,
      title: "Tip",
      containerClass: "border-emerald-500/40 bg-emerald-500/10 text-emerald-900 dark:text-emerald-100",
      iconClass: "text-emerald-600 dark:text-emerald-400",
    },
    IMPORTANT: {
      icon: Info,
      title: "Important",
      containerClass: "border-purple-500/40 bg-purple-500/10 text-purple-900 dark:text-purple-100",
      iconClass: "text-purple-600 dark:text-purple-400",
    },
    WARNING: {
      icon: AlertTriangle,
      title: "Warning",
      containerClass: "border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-100",
      iconClass: "text-amber-600 dark:text-amber-400",
    },
    CAUTION: {
      icon: AlertOctagon,
      title: "Caution",
      containerClass: "border-rose-500/40 bg-rose-500/10 text-rose-900 dark:text-rose-100",
      iconClass: "text-rose-600 dark:text-rose-400",
    },
  };

  const cfg = configs[type] || configs.NOTE;
  const Icon = cfg.icon;

  return (
    <div
      className={cn(
        "my-4 rounded-xl border-l-4 p-3.5 text-xs space-y-1.5 shadow-2xs",
        cfg.containerClass
      )}
    >
      <div className="flex items-center gap-1.5 font-semibold">
        <Icon className={cn("h-4 w-4 shrink-0", cfg.iconClass)} />
        <span>{cfg.title}</span>
      </div>
      <div className="space-y-1 pl-5.5 text-zinc-700 dark:text-zinc-300">
        {lines.map((l, idx) => (
          <p key={idx}>{parseInlineTokens(l)}</p>
        ))}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------------------
// Main MarkdownViewer Component
// ------------------------------------------------------------------------------
export function MarkdownViewer({ content, filePath, onDiscussSelection }: MarkdownViewerProps) {
  const { locale } = useLanguage();
  const isPt = locale === "pt";

  const containerRef = React.useRef<HTMLDivElement>(null);
  const floatingRef = React.useRef<HTMLDivElement>(null);
  const [floatingAction, setFloatingAction] = React.useState<{
    x: number;
    y: number;
    text: string;
  } | null>(null);

  // Floating "Adicionar ao Chat" trigger on text selection inside Markdown preview
  const handleMouseUp = React.useCallback(() => {
    if (!onDiscussSelection) return;
    setTimeout(() => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || !sel.toString().trim()) {
        setFloatingAction(null);
        return;
      }

      if (containerRef.current && containerRef.current.contains(sel.anchorNode)) {
        const text = sel.toString().trim();
        try {
          const range = sel.getRangeAt(0);
          const rect = range.getBoundingClientRect();
          const containerRect = containerRef.current.getBoundingClientRect();
          const x = rect.left - containerRect.left + rect.width / 2;
          const y = rect.top - containerRect.top;
          setFloatingAction({
            x: Math.max(90, Math.min(x, containerRect.width - 90)),
            y: Math.max(30, y),
            text,
          });
          return;
        } catch {
          // ignore
        }
      }
      setFloatingAction(null);
    }, 20);
  }, [onDiscussSelection]);

  // Click outside to dismiss floating action
  React.useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      if (floatingRef.current && !floatingRef.current.contains(e.target as Node)) {
        setFloatingAction(null);
      }
    };
    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, []);

  // Parse markdown content line-by-line into blocks
  const renderedBlocks = React.useMemo(() => {
    if (!content) return [];
    const lines = content.split("\n");
    const blocks: React.ReactNode[] = [];

    let i = 0;
    while (i < lines.length) {
      const line = lines[i];
      const trimmed = line.trim();

      // Empty line
      if (!trimmed) {
        i++;
        continue;
      }

      // 1. Fenced Code Block
      if (trimmed.startsWith("```")) {
        const lang = trimmed.slice(3).trim();
        const codeLines: string[] = [];
        i++;
        while (i < lines.length && !lines[i].trim().startsWith("```")) {
          codeLines.push(lines[i]);
          i++;
        }
        if (i < lines.length) i++; // consume closing ```
        blocks.push(
          <MarkdownCodeBlock
            key={`code-block-${i}`}
            code={codeLines.join("\n")}
            lang={lang}
          />
        );
        continue;
      }

      // 2. GitHub Alerts or Blockquotes (> [!NOTE] or > text)
      if (trimmed.startsWith(">")) {
        const alertMatch = trimmed.match(/^>\s*\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]/i);
        if (alertMatch) {
          const alertType = alertMatch[1].toUpperCase() as "NOTE" | "TIP" | "IMPORTANT" | "WARNING" | "CAUTION";
          const quoteLines: string[] = [];
          i++;
          while (i < lines.length && lines[i].trim().startsWith(">")) {
            quoteLines.push(lines[i].replace(/^>\s?/, ""));
            i++;
          }
          blocks.push(
            <MarkdownAlert
              key={`alert-${i}`}
              type={alertType}
              lines={quoteLines}
            />
          );
          continue;
        }

        // Standard Blockquote
        const quoteLines: string[] = [trimmed.replace(/^>\s?/, "")];
        i++;
        while (i < lines.length && lines[i].trim().startsWith(">")) {
          quoteLines.push(lines[i].replace(/^>\s?/, ""));
          i++;
        }
        blocks.push(
          <blockquote
            key={`quote-${i}`}
            className="my-3 pl-4 border-l-2 border-zinc-300 dark:border-zinc-700 italic text-muted-foreground text-xs leading-relaxed space-y-1"
          >
            {quoteLines.map((ql, qIdx) => (
              <p key={qIdx}>{parseInlineTokens(ql)}</p>
            ))}
          </blockquote>
        );
        continue;
      }

      // 3. Tables (starts with | and followed by |---|)
      if (trimmed.startsWith("|") && i + 1 < lines.length && lines[i + 1].trim().includes("|") && lines[i + 1].includes("-")) {
        const tableLines: string[] = [line];
        i++;
        while (i < lines.length && lines[i].trim().startsWith("|")) {
          tableLines.push(lines[i]);
          i++;
        }
        blocks.push(<MarkdownTable key={`table-${i}`} rows={tableLines} />);
        continue;
      }

      // 4. Headings (# Heading)
      const hMatch = trimmed.match(/^(#{1,6})\s+(.*)$/);
      if (hMatch) {
        const level = hMatch[1].length;
        const text = hMatch[2];
        const parsed = parseInlineTokens(text);

        switch (level) {
          case 1:
            blocks.push(
              <h1
                key={`h1-${i}`}
                className="text-2xl font-bold tracking-tight text-foreground pb-2 border-b border-border/70 mt-6 mb-3 first:mt-0"
              >
                {parsed}
              </h1>
            );
            break;
          case 2:
            blocks.push(
              <h2
                key={`h2-${i}`}
                className="text-xl font-bold tracking-tight text-foreground pb-1.5 border-b border-border/50 mt-5 mb-2.5"
              >
                {parsed}
              </h2>
            );
            break;
          case 3:
            blocks.push(
              <h3
                key={`h3-${i}`}
                className="text-lg font-semibold text-foreground mt-4 mb-2"
              >
                {parsed}
              </h3>
            );
            break;
          case 4:
            blocks.push(
              <h4
                key={`h4-${i}`}
                className="text-base font-semibold text-foreground mt-3 mb-1.5"
              >
                {parsed}
              </h4>
            );
            break;
          case 5:
            blocks.push(
              <h5
                key={`h5-${i}`}
                className="text-sm font-semibold text-foreground mt-3 mb-1"
              >
                {parsed}
              </h5>
            );
            break;
          case 6:
            blocks.push(
              <h6
                key={`h6-${i}`}
                className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mt-3 mb-1"
              >
                {parsed}
              </h6>
            );
            break;
        }
        i++;
        continue;
      }

      // 5. Horizontal Rule (---, ***, ___)
      if (/^(\*{3,}|-{3,}|_{3,})$/.test(trimmed)) {
        blocks.push(
          <hr
            key={`hr-${i}`}
            className="my-5 border-t border-border/60"
          />
        );
        i++;
        continue;
      }

      // 6. Lists (Task lists, Bullet lists, Ordered lists)
      const isBullet = /^[-*+]\s+/.test(trimmed);
      const isOrdered = /^\d+\.\s+/.test(trimmed);

      if (isBullet || isOrdered) {
        const listItems: { text: string; isTask?: boolean; checked?: boolean }[] = [];
        const isOrderedList = isOrdered;

        while (i < lines.length) {
          const itemTrimmed = lines[i].trim();
          if (!itemTrimmed) break;

          const itemBullet = /^[-*+]\s+/.test(itemTrimmed);
          const itemNumbered = /^\d+\.\s+/.test(itemTrimmed);
          if (!itemBullet && !itemNumbered) break;

          const rawItem = itemTrimmed.replace(/^([-*+]|\d+\.)\s+/, "");

          // Task item: [ ] or [x]
          const taskMatch = rawItem.match(/^\[([ xX])\]\s+(.*)$/);
          if (taskMatch) {
            listItems.push({
              isTask: true,
              checked: taskMatch[1].toLowerCase() === "x",
              text: taskMatch[2],
            });
          } else {
            listItems.push({
              text: rawItem,
            });
          }
          i++;
        }

        if (isOrderedList && !listItems.some((l) => l.isTask)) {
          blocks.push(
            <ol
              key={`ol-${i}`}
              className="list-decimal list-inside space-y-1 my-2.5 text-xs text-zinc-700 dark:text-zinc-300 leading-relaxed"
            >
              {listItems.map((item, idx) => (
                <li key={idx} className="pl-1">
                  {parseInlineTokens(item.text)}
                </li>
              ))}
            </ol>
          );
        } else {
          blocks.push(
            <ul
              key={`ul-${i}`}
              className="space-y-1.5 my-2.5 text-xs text-zinc-700 dark:text-zinc-300 leading-relaxed"
            >
              {listItems.map((item, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  {item.isTask ? (
                    <span className="mt-0.5 shrink-0 text-muted-foreground">
                      {item.checked ? (
                        <CheckSquare className="h-3.5 w-3.5 text-blue-500" />
                      ) : (
                        <Square className="h-3.5 w-3.5 opacity-60" />
                      )}
                    </span>
                  ) : (
                    <span className="h-1.5 w-1.5 rounded-full bg-zinc-400 dark:bg-zinc-600 mt-1.5 shrink-0" />
                  )}
                  <span className={cn(item.isTask && item.checked && "line-through text-muted-foreground")}>
                    {parseInlineTokens(item.text)}
                  </span>
                </li>
              ))}
            </ul>
          );
        }
        continue;
      }

      // 7. Regular Paragraph
      const paraLines: string[] = [line];
      i++;
      while (
        i < lines.length &&
        lines[i].trim() &&
        !lines[i].trim().startsWith("#") &&
        !lines[i].trim().startsWith("```") &&
        !lines[i].trim().startsWith(">") &&
        !lines[i].trim().startsWith("|") &&
        !/^[-*+]\s+/.test(lines[i].trim()) &&
        !/^\d+\.\s+/.test(lines[i].trim())
      ) {
        paraLines.push(lines[i]);
        i++;
      }

      blocks.push(
        <p
          key={`p-${i}`}
          className="text-xs leading-relaxed text-zinc-700 dark:text-zinc-300 my-2.5"
        >
          {parseInlineTokens(paraLines.join(" "))}
        </p>
      );
    }

    return blocks;
  }, [content]);

  return (
    <div
      ref={containerRef}
      onMouseUp={handleMouseUp}
      className="relative p-6 sm:p-8 bg-white dark:bg-[#18181b] text-foreground select-text overflow-y-auto flex-1 min-h-0 transition-colors"
    >
      {/* Rendered Document Container */}
      <div className="max-w-4xl mx-auto space-y-1">
        {renderedBlocks}
      </div>

      {/* Floating Action Pill for Discussions */}
      {floatingAction && onDiscussSelection && (
        <div
          ref={floatingRef}
          style={{ top: floatingAction.y, left: floatingAction.x }}
          className="absolute z-40 -translate-x-1/2 -translate-y-full mb-1 flex items-center gap-1.5 rounded-full border border-blue-500/40 bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 px-3 py-1 shadow-xl text-xs font-medium cursor-pointer hover:scale-105 active:scale-95 transition-all select-none animate-in fade-in zoom-in-95 duration-100"
          onMouseDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onDiscussSelection({
              filePath,
              selectedCode: floatingAction.text,
            });
            setFloatingAction(null);
          }}
        >
          <MessageSquare className="h-3.5 w-3.5 text-blue-400 dark:text-blue-600" />
          <span>{isPt ? "Adicionar ao Chat" : "Add to Chat"}</span>
        </div>
      )}
    </div>
  );
}
