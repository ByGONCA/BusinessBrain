/**
 * Codebase Map Integrity Validator
 *
 * Deterministically extracts and validates all explicit file and directory
 * references documented in `docs/CODEBASE_MAP.md` against the repository filesystem.
 *
 * Requirements:
 * - Read-only, zero side effects (does not alter files or make network requests)
 * - Safe against path traversal attempts (`../`)
 * - Distinguishes explicit files, directories, dynamic routes, and command examples
 * - Returns exit code 0 when all references are valid, non-zero when invalid
 */

import fs from "fs";
import path from "path";

export type ReferenceType = "file" | "directory" | "pattern" | "ignored";

export interface MapReference {
  raw: string;
  cleanPath: string;
  line: number;
  type: ReferenceType;
}

export interface ValidationResult {
  valid: boolean;
  totalReferencesChecked: number;
  validPaths: string[];
  invalidPaths: Array<{ path: string; line: number; reason: string }>;
  ignoredCount: number;
}

// Known command or tooling prefixes to ignore
const IGNORED_COMMAND_PREFIXES = [
  "npm ",
  "npx ",
  "pnpm ",
  "yarn ",
  "git ",
  "tsc ",
  "eslint ",
  "node ",
  "tsx ",
];

// Code symbols, environment tokens, and SQL keywords to ignore
const IGNORED_EXACT_TOKENS = new Set([
  "revision_id",
  "active",
  "trialing",
  "cb_live_...",
  "cb_active_org_id",
  "X-Organization-Id",
  "sb-*",
  "00001",
  "00002",
  "00003",
  "00004",
  "00006",
  "00007",
  "00008",
  "00009",
  "00011",
  "00012",
  "00017",
  "00018",
  "00020",
  "00021",
  "00022",
  "00023",
  "00024",
  "00026",
  "00027",
  "00028",
  "00029",
  "00030",
  "00031",
  "00032",
  "00033",
  "00034",
  "00035",
  "00036",
  "starter",
  "pro",
  "enterprise",
  "refresh_token_not_found",
  "checkout.session.completed",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "discussions",
  "documents",
  "integrations",
  "metrics",
  "projects",
  "keys",
  "github/",
  "slack/",
  "google/",
  "microsoft/",
  "importers/",
  "en.ts",
  "pt.ts",
  "es.ts",
  "fr.ts",
  "t.[namespace].[key]",
  "interpolate(...)",
  "O(V + E)",
  "O(V+E)",
]);

const TOP_LEVEL_FILES = new Set([
  "proxy.ts",
  "package.json",
  "AGENTS.md",
  "tsconfig.json",
  ".gitignore",
  ".env.example",
]);

/**
 * Classifies a backticked raw string extracted from markdown.
 */
export function classifyReference(raw: string): { type: ReferenceType; cleanPath: string } {
  const trimmed = raw.trim();

  // 1. External URLs
  if (/^https?:\/\//i.test(trimmed)) {
    return { type: "ignored", cleanPath: trimmed };
  }

  // 1b. Scoped npm package names (e.g. @supabase/ssr)
  if (trimmed.startsWith("@") && trimmed.includes("/")) {
    return { type: "ignored", cleanPath: trimmed };
  }

  // 1c. Web HTTP routes (e.g. /login, /dashboard)
  if (trimmed.startsWith("/") && !trimmed.includes(".")) {
    return { type: "ignored", cleanPath: trimmed };
  }

  // 2. Command executions
  if (IGNORED_COMMAND_PREFIXES.some((prefix) => trimmed.startsWith(prefix))) {
    return { type: "ignored", cleanPath: trimmed };
  }

  // 3. Known non-path symbols
  if (IGNORED_EXACT_TOKENS.has(trimmed)) {
    return { type: "ignored", cleanPath: trimmed };
  }

  // 4. Wildcard patterns (e.g. *.sql)
  if (trimmed.includes("*")) {
    return { type: "pattern", cleanPath: trimmed };
  }

  // 5. Must look like a repository path
  const hasFileExtension = /\.(ts|tsx|js|mjs|cjs|json|sql|md|css|html)$/i.test(trimmed);
  const hasSlash = trimmed.includes("/");
  const isTopLevel = TOP_LEVEL_FILES.has(trimmed);

  if (!hasSlash && !isTopLevel && !hasFileExtension) {
    return { type: "ignored", cleanPath: trimmed };
  }

  // Normalize directory vs file
  if (trimmed.endsWith("/")) {
    return { type: "directory", cleanPath: trimmed.slice(0, -1) };
  }

  return { type: "file", cleanPath: trimmed };
}

/**
 * Extracts and classifies candidate references from markdown content.
 */
export function parseMapReferences(content: string): MapReference[] {
  const lines = content.split(/\r?\n/);
  const references: MapReference[] = [];
  const regex = /`([^`\n]+)`/g;

  lines.forEach((lineText, lineIdx) => {
    let match: RegExpExecArray | null;
    while ((match = regex.exec(lineText)) !== null) {
      const raw = match[1];
      const { type, cleanPath } = classifyReference(raw);
      references.push({
        raw,
        cleanPath,
        line: lineIdx + 1,
        type,
      });
    }
  });

  return references;
}

/**
 * Validates extracted map references against a target repository root directory.
 */
export function validateMapReferences(
  references: MapReference[],
  rootDir: string
): ValidationResult {
  const normalizedRoot = path.resolve(rootDir);
  const validPaths: string[] = [];
  const invalidPaths: Array<{ path: string; line: number; reason: string }> = [];
  let ignoredCount = 0;
  let verifiableCount = 0;

  for (const ref of references) {
    if (ref.type === "ignored" || ref.type === "pattern") {
      ignoredCount++;
      continue;
    }

    verifiableCount++;

    // Security Check: Detect path traversal outside root
    const resolvedPath = path.resolve(normalizedRoot, ref.cleanPath);
    const relativeToRoot = path.relative(normalizedRoot, resolvedPath);

    if (relativeToRoot.startsWith("..") || path.isAbsolute(ref.cleanPath)) {
      invalidPaths.push({
        path: ref.cleanPath,
        line: ref.line,
        reason: "Path traversal or absolute path escapes repository root",
      });
      continue;
    }

    // Existence check
    if (!fs.existsSync(resolvedPath)) {
      invalidPaths.push({
        path: ref.cleanPath,
        line: ref.line,
        reason: "Path does not exist on disk",
      });
      continue;
    }

    // Type consistency check (directory vs file)
    const stat = fs.statSync(resolvedPath);
    if (ref.type === "directory" && !stat.isDirectory()) {
      invalidPaths.push({
        path: ref.cleanPath,
        line: ref.line,
        reason: "Path was documented as a directory (trailing /) but is a file",
      });
      continue;
    }

    validPaths.push(ref.cleanPath);
  }

  // If no verifiable references were found in the file, fail explicitly
  if (verifiableCount === 0) {
    return {
      valid: false,
      totalReferencesChecked: 0,
      validPaths: [],
      invalidPaths: [
        {
          path: "(none)",
          line: 0,
          reason: "No verifiable file or directory references found in the map",
        },
      ],
      ignoredCount,
    };
  }

  return {
    valid: invalidPaths.length === 0,
    totalReferencesChecked: verifiableCount,
    validPaths,
    invalidPaths,
    ignoredCount,
  };
}

/**
 * Executes full validation for a given map file against a root directory.
 */
export function runMapValidation(
  mapPath: string = path.join(process.cwd(), "docs", "CODEBASE_MAP.md"),
  rootDir: string = process.cwd()
): ValidationResult {
  if (!fs.existsSync(mapPath)) {
    return {
      valid: false,
      totalReferencesChecked: 0,
      validPaths: [],
      invalidPaths: [
        {
          path: mapPath,
          line: 0,
          reason: `Codebase map file not found at: ${mapPath}`,
        },
      ],
      ignoredCount: 0,
    };
  }

  const content = fs.readFileSync(mapPath, "utf8");
  const references = parseMapReferences(content);
  return validateMapReferences(references, rootDir);
}

// CLI entrypoint
if (require.main === module) {
  const targetMap = process.argv[2] || path.join(process.cwd(), "docs", "CODEBASE_MAP.md");
  const targetRoot = process.argv[3] || process.cwd();

  console.log(`\n======================================================`);
  console.log(`🔍 CODEBASE MAP INTEGRITY VALIDATOR`);
  console.log(`======================================================`);
  console.log(`Map Target : ${path.relative(process.cwd(), targetMap)}`);
  console.log(`Root Dir   : ${path.relative(process.cwd(), targetRoot) || "."}`);

  const result = runMapValidation(targetMap, targetRoot);

  if (result.valid) {
    console.log(`\n✅ SUCCESS: All ${result.totalReferencesChecked} documented paths are valid and exist on disk!`);
    console.log(`ℹ️  Ignored non-path references (commands, tokens, URLs): ${result.ignoredCount}\n`);
    process.exit(0);
  } else {
    console.error(`\n❌ INTEGRITY FAILURE: Found ${result.invalidPaths.length} invalid reference(s):`);
    result.invalidPaths.forEach((err) => {
      console.error(`  - Line ${err.line}: "${err.path}" -> ${err.reason}`);
    });
    console.error("");
    process.exit(1);
  }
}
