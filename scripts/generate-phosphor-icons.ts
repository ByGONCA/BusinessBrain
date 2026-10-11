import fs from "fs";
import path from "path";

const iconsDir = path.join(process.cwd(), "public", "Icons");
const targetFile = path.join(process.cwd(), "components", "icons", "phosphor-icons.tsx");

function toPascalCase(str: string): string {
  return str
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
}

export function generatePhosphorIcons() {
  const files = fs.readdirSync(iconsDir).filter((f) => f.endsWith(".svg")).sort();

  const iconDefinitions: { name: string; pascalName: string; pathD: string; viewBox: string }[] = [];

  for (const file of files) {
    const rawName = file.replace(/\.svg$/, "");
    const pascalName = `Phosphor${toPascalCase(rawName)}`;
    const content = fs.readFileSync(path.join(iconsDir, file), "utf-8");

    const viewBoxMatch = content.match(/viewBox=["']([^"']+)["']/);
    const viewBox = viewBoxMatch ? viewBoxMatch[1] : "0 0 256 256";

    const pathMatch = content.match(/<path\s+d=["']([^"']+)["'][^>]*>/);
    if (!pathMatch) {
      console.warn(`No path found in ${file}`);
      continue;
    }
    const pathD = pathMatch[1];

    iconDefinitions.push({
      name: rawName,
      pascalName,
      pathD,
      viewBox,
    });
  }

  let code = `// ==============================================================================
// BusinessBrain — Phosphor Icon System
// Auto-generated from SVG assets in public/Icons/
// Built with zero extra dependencies, strict TypeScript & currentColor theming
// ==============================================================================

import * as React from "react";
import { cn } from "@/lib/utils";

export interface PhosphorIconProps extends React.SVGProps<SVGSVGElement> {
  className?: string;
  size?: number | string;
}

`;

  for (const item of iconDefinitions) {
    code += `export function ${item.pascalName}({ className, size, ...props }: PhosphorIconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="${item.viewBox}"
      fill="currentColor"
      width={size}
      height={size}
      aria-hidden="true"
      className={cn("shrink-0", className)}
      {...props}
    >
      <path d="${item.pathD}" />
    </svg>
  );
}

`;
  }

  code += `export type PhosphorIconName =
${iconDefinitions.map((i) => `  | "${i.name}"`).join("\n")};

export const PHOSPHOR_ICONS: Record<
  PhosphorIconName,
  React.ComponentType<PhosphorIconProps>
> = {
${iconDefinitions.map((i) => `  "${i.name}": ${i.pascalName},`).join("\n")}
};

export interface AppIconProps extends PhosphorIconProps {
  name: PhosphorIconName;
}

export function AppIcon({ name, ...props }: AppIconProps) {
  const IconComponent = PHOSPHOR_ICONS[name];
  if (!IconComponent) return null;
  return <IconComponent {...props} />;
}
`;

  fs.mkdirSync(path.dirname(targetFile), { recursive: true });
  fs.writeFileSync(targetFile, code, "utf-8");
  console.log(`Generated ${iconDefinitions.length} Phosphor icons in ${targetFile}`);
}

generatePhosphorIcons();
