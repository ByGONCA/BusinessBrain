import fs from "fs";
import path from "path";

interface IconAuditItem {
  fileName: string;
  id: string;
  viewBox: string;
  paths: string[];
  sizeBytes: number;
}

const iconsDir = path.join(process.cwd(), "public", "Icons");
const logosDir = path.join(process.cwd(), "public", "Logos");

export function getPublicIcons(): IconAuditItem[] {
  if (!fs.existsSync(iconsDir)) return [];
  const files = fs.readdirSync(iconsDir).filter((f) => f.endsWith(".svg"));

  return files.map((fileName) => {
    const fullPath = path.join(iconsDir, fileName);
    const content = fs.readFileSync(fullPath, "utf-8");
    const viewBoxMatch = content.match(/viewBox=["']([^"']+)["']/);
    const pathMatches = Array.from(content.matchAll(/<path\s+d=["']([^"']+)["'][^>]*>/g)).map(
      (m) => m[1]
    );

    return {
      fileName,
      id: fileName.replace(/\.svg$/, ""),
      viewBox: viewBoxMatch ? viewBoxMatch[1] : "0 0 256 256",
      paths: pathMatches,
      sizeBytes: fs.statSync(fullPath).size,
    };
  });
}

const icons = getPublicIcons();
console.log(`Audited ${icons.length} icons from public/Icons:`);
icons.forEach((ic) => {
  console.log(`- ${ic.id}: ${ic.paths.length} path(s), viewBox="${ic.viewBox}", ${ic.sizeBytes} B`);
});
