// ==============================================================================
// BusinessBrain: Code Viewer Syntax Highlighter Engine (Prism.js / Zero-HTML)
// Provides secure, typed AST tokenization for VS Code-like code viewing
// ==============================================================================

import Prism from "./prism-loader";

// Import commonly used language grammars in strict dependency sequence
import "prismjs/components/prism-markup";
import "prismjs/components/prism-javascript";
import "prismjs/components/prism-jsx";
import "prismjs/components/prism-typescript";
import "prismjs/components/prism-tsx";
import "prismjs/components/prism-json";
import "prismjs/components/prism-yaml";
import "prismjs/components/prism-toml";
import "prismjs/components/prism-css";
import "prismjs/components/prism-markdown";
import "prismjs/components/prism-python";
import "prismjs/components/prism-sql";
import "prismjs/components/prism-bash";
import "prismjs/components/prism-docker";

export interface CodeToken {
  type?: string;
  content: string;
}

export interface HighlightedLine {
  lineNumber: number;
  tokens: CodeToken[];
  rawText: string;
}

/**
 * Resolves a Prism language identifier from a file path or extension.
 */
export function detectLanguageFromPath(filePath: string): { lang: string; label: string } {
  const normalized = filePath.toLowerCase().trim();
  const filename = normalized.split("/").pop() || "";

  if (filename === "dockerfile" || filename.startsWith("dockerfile.")) {
    return { lang: "docker", label: "Dockerfile" };
  }
  if (filename === "makefile") {
    return { lang: "bash", label: "Makefile" };
  }

  const ext = filename.includes(".") ? filename.split(".").pop() || "" : "";

  switch (ext) {
    case "ts":
      return { lang: "typescript", label: "TypeScript" };
    case "tsx":
      return { lang: "tsx", label: "TypeScript React" };
    case "js":
    case "mjs":
    case "cjs":
      return { lang: "javascript", label: "JavaScript" };
    case "jsx":
      return { lang: "jsx", label: "JavaScript React" };
    case "json":
      return { lang: "json", label: "JSON" };
    case "yaml":
    case "yml":
      return { lang: "yaml", label: "YAML" };
    case "toml":
      return { lang: "toml", label: "TOML" };
    case "css":
    case "scss":
    case "sass":
      return { lang: "css", label: "CSS" };
    case "html":
    case "htm":
    case "svg":
    case "xml":
      return { lang: "markup", label: "HTML / XML" };
    case "md":
    case "markdown":
    case "mdx":
      return { lang: "markdown", label: "Markdown" };
    case "py":
      return { lang: "python", label: "Python" };
    case "sql":
      return { lang: "sql", label: "SQL" };
    case "sh":
    case "bash":
    case "zsh":
      return { lang: "bash", label: "Shell" };
    default:
      return { lang: "plaintext", label: ext ? ext.toUpperCase() : "Plain Text" };
  }
}

/**
 * Tokenizes source code line-by-line into typed tokens.
 * Guarantees zero raw HTML generation (XSS safe).
 */
export function tokenizeCodeToLines(code: string, language: string): HighlightedLine[] {
  if (!code) {
    return [{ lineNumber: 1, tokens: [{ content: "" }], rawText: "" }];
  }

  const grammar = Prism.languages[language] || Prism.languages.plain || null;
  const rawLines = code.split("\n");

  if (!grammar) {
    return rawLines.map((line, idx) => ({
      lineNumber: idx + 1,
      tokens: [{ content: line || " " }],
      rawText: line,
    }));
  }

  const rawTokens = Prism.tokenize(code, grammar);
  const tokenLines: CodeToken[][] = [[]];

  function processToken(token: string | Prism.Token, inheritedType?: string) {
    if (typeof token === "string") {
      const parts = token.split("\n");
      for (let i = 0; i < parts.length; i++) {
        if (i > 0) {
          tokenLines.push([]);
        }
        if (parts[i]) {
          tokenLines[tokenLines.length - 1].push({
            type: inheritedType,
            content: parts[i],
          });
        }
      }
    } else if (Array.isArray(token.content)) {
      for (const sub of token.content) {
        processToken(sub, token.type || inheritedType);
      }
    } else if (typeof token.content === "string") {
      const parts = token.content.split("\n");
      for (let i = 0; i < parts.length; i++) {
        if (i > 0) {
          tokenLines.push([]);
        }
        if (parts[i]) {
          tokenLines[tokenLines.length - 1].push({
            type: token.type || inheritedType,
            content: parts[i],
          });
        }
      }
    } else {
      processToken(token.content, token.type || inheritedType);
    }
  }

  for (const token of rawTokens) {
    processToken(token);
  }

  // Ensure line count matches raw lines
  while (tokenLines.length < rawLines.length) {
    tokenLines.push([]);
  }

  return tokenLines.map((tokens, idx) => ({
    lineNumber: idx + 1,
    tokens: tokens.length > 0 ? tokens : [{ content: " " }],
    rawText: rawLines[idx] || "",
  }));
}

/**
 * Returns Tailwind/CSS classes for a specific token type matching VS Code Dark+ & Light+.
 */
export function getTokenClasses(tokenType?: string): string {
  if (!tokenType) {
    return "text-zinc-800 dark:text-zinc-200";
  }

  const base = tokenType.toLowerCase();

  if (base.includes("keyword") || base.includes("atrule")) {
    return "bb-code-keyword text-blue-600 dark:text-[#569cd6] font-medium";
  }

  if (base.includes("string") || base.includes("char") || base.includes("attr-value")) {
    return "bb-code-string text-emerald-700 dark:text-[#ce9178]";
  }

  if (base.includes("comment") || base.includes("prolog") || base.includes("doctype") || base.includes("cdata")) {
    return "bb-code-comment text-zinc-500 dark:text-[#6a9955] italic";
  }

  if (base.includes("function") || base.includes("class-name")) {
    return "bb-code-function text-amber-700 dark:text-[#dcdcaa]";
  }

  if (base.includes("number") || base.includes("boolean") || base.includes("constant")) {
    return "bb-code-number text-emerald-600 dark:text-[#b5cea8] font-medium";
  }

  if (base.includes("property") || base.includes("variable")) {
    return "bb-code-property text-indigo-600 dark:text-[#9cdcfe]";
  }

  if (base.includes("tag")) {
    return "bb-code-tag text-rose-700 dark:text-[#569cd6] font-medium";
  }

  if (base.includes("attr-name")) {
    return "bb-code-attr-name text-amber-600 dark:text-[#9cdcfe]";
  }

  if (base.includes("builtin") || base.includes("selector")) {
    return "bb-code-builtin text-teal-600 dark:text-[#4ec9b0]";
  }

  if (base.includes("operator") || base.includes("punctuation") || base.includes("script-punctuation")) {
    return "bb-code-punctuation text-zinc-600 dark:text-zinc-300";
  }

  if (base.includes("regex") || base.includes("important")) {
    return "bb-code-regex text-rose-600 dark:text-[#d16969]";
  }

  return "text-zinc-800 dark:text-zinc-200";
}
