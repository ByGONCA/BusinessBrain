import fs from "fs";
import path from "path";
import { PERMISSIONS_REGISTRY, PERMISSION_KEYS } from "../lib/permissions/registry";

interface AuditResult {
  key: string;
  name: string;
  category: string;
  description: string;
  inRegistry: boolean;
  uiOccurrences: string[];
  backendOccurrences: string[];
  rlsOccurrences: string[];
}

function searchFiles(dir: string, extFilter: string[]): string[] {
  let files: string[] = [];
  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    if (item.name === "node_modules" || item.name === ".next" || item.name === ".git") continue;
    const full = path.join(dir, item.name);
    if (item.isDirectory()) {
      files = files.concat(searchFiles(full, extFilter));
    } else if (extFilter.some(ext => item.name.endsWith(ext))) {
      files.push(full);
    }
  }
  return files;
}

const root = path.resolve(__dirname, "..");
const tsFiles = searchFiles(root, [".ts", ".tsx"]);
const sqlFiles = searchFiles(path.join(root, "database"), [".sql"]);

console.log(`Auditing ${PERMISSION_KEYS.length} permissions across ${tsFiles.length} TS files and ${sqlFiles.length} SQL files...\n`);

const results: AuditResult[] = [];

for (const p of PERMISSIONS_REGISTRY) {
  const uiOccurrences: string[] = [];
  const backendOccurrences: string[] = [];
  const rlsOccurrences: string[] = [];

  for (const file of tsFiles) {
    const rel = path.relative(root, file).replace(/\\/g, "/");
    if (rel.startsWith("lib/permissions/registry.ts") || rel.startsWith("scripts/")) continue;

    const content = fs.readFileSync(file, "utf-8");
    if (content.includes(`"${p.key}"`) || content.includes(`'${p.key}'`)) {
      if (rel.startsWith("components/")) {
        uiOccurrences.push(rel);
      } else {
        backendOccurrences.push(rel);
      }
    }
  }

  for (const file of sqlFiles) {
    const rel = path.relative(root, file).replace(/\\/g, "/");
    const content = fs.readFileSync(file, "utf-8");
    if (content.includes(`'${p.key}'`)) {
      rlsOccurrences.push(rel);
    }
  }

  results.push({
    key: p.key,
    name: p.name,
    category: p.category,
    description: p.description,
    inRegistry: true,
    uiOccurrences,
    backendOccurrences,
    rlsOccurrences,
  });
}

console.log("| Key | Category | Backend Checks | UI Checks | RLS Checks | Status |");
console.log("|---|---|---|---|---|---|");

for (const r of results) {
  let status = "NO EFFECT";
  if (r.backendOccurrences.length > 0 && r.rlsOccurrences.length > 0) {
    status = "FULL (BE + RLS)";
  } else if (r.backendOccurrences.length > 0) {
    status = "BACKEND ONLY";
  } else if (r.uiOccurrences.length > 0) {
    status = "UI ONLY";
  }
  console.log(`| \`${r.key}\` | ${r.category} | ${r.backendOccurrences.join(", ") || "None"} | ${r.uiOccurrences.join(", ") || "None"} | ${r.rlsOccurrences.join(", ") || "None"} | **${status}** |`);
}
