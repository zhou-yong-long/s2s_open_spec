import { mkdirSync, readFileSync, writeFileSync, readdirSync, statSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const scaffoldDir = join(__dirname, "..", "..", "scaffold");

export interface ScaffoldVars {
  author: string;
  date: string;
}

export function renderTemplate(template: string, vars: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replaceAll(`{{${key}}}`, value);
  }
  return result;
}

export function copyScaffold(targetDir: string, vars: ScaffoldVars): void {
  copyDir(scaffoldDir, targetDir, vars);
}

function copyDir(src: string, dest: string, vars: ScaffoldVars): void {
  mkdirSync(dest, { recursive: true });
  for (const entry of readdirSync(src)) {
    const srcPath = join(src, entry);
    const destPath = join(dest, entry);
    if (statSync(srcPath).isDirectory()) {
      copyDir(srcPath, destPath, vars);
    } else {
      const content = renderTemplate(readFileSync(srcPath, "utf-8"), { ...vars });
      mkdirSync(dirname(destPath), { recursive: true });
      writeFileSync(destPath, content);
    }
  }
}
