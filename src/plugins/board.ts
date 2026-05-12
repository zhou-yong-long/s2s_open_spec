import { readdirSync, existsSync, readFileSync } from "fs";
import { join } from "path";
import yaml from "js-yaml";
import chalk from "chalk";
import { SPEC_STATUSES, type SpecStatus } from "../core/spec.js";
import { readConfig } from "../core/config.js";

export interface BoardSpec {
  fileName: string;
  title: string;
  status: SpecStatus;
  author: string;
  domain: string | null;
  created: string;
  tags: string[];
}

export interface ScanOptions {
  domain?: string;
  author?: string;
  status?: SpecStatus;
}

function coerceStatus(value: unknown): SpecStatus {
  if (typeof value === "string" && (SPEC_STATUSES as readonly string[]).includes(value)) {
    return value as SpecStatus;
  }
  return "draft";
}

function parseSpecFrontmatter(filePath: string): { title: string; status: SpecStatus; author: string; domain: string | null; created: string; tags: string[] } | null {
  try {
    const content = readFileSync(filePath, "utf-8");
    const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
    if (!match) return null;
    const raw = (yaml.load(match[1]) as Record<string, unknown>) ?? {};
    const title = (match[2].split("\n")[0] || "").replace(/^# /, "").trim() || "Untitled";
    return {
      title,
      status: coerceStatus(raw.status),
      author: typeof raw.author === "string" ? raw.author : "",
      domain: raw.domain === null || raw.domain === undefined ? null : String(raw.domain),
      created: typeof raw.created === "string" ? raw.created : "",
      tags: Array.isArray(raw.tags) ? raw.tags.map(String) : [],
    };
  } catch {
    return null;
  }
}

function scanDir(dir: string): { fileName: string; filePath: string }[] {
  if (!existsSync(dir)) return [];
  const results: { fileName: string; filePath: string }[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      results.push(...scanDir(join(dir, entry.name)));
    } else if (entry.name.endsWith(".md") && !entry.name.startsWith(".")) {
      results.push({ fileName: entry.name, filePath: join(dir, entry.name) });
    }
  }
  return results;
}

export function scanSpecs(projectRoot: string, options?: ScanOptions): BoardSpec[] {
  let activeDir: string;
  try {
    const config = readConfig(projectRoot);
    activeDir = join(projectRoot, config.paths.active);
  } catch {
    activeDir = join(projectRoot, "specs/active");
  }

  const files = scanDir(activeDir);
  const specs: BoardSpec[] = [];
  for (const f of files) {
    const fm = parseSpecFrontmatter(f.filePath);
    if (!fm) continue;
    specs.push({
      fileName: f.fileName,
      ...fm,
    });
  }

  let result = specs;
  if (options?.domain) result = result.filter(s => s.domain === options.domain);
  if (options?.author) result = result.filter(s => s.author === options.author);
  if (options?.status) result = result.filter(s => s.status === options.status);
  return result;
}

const COLUMNS: { status: SpecStatus; label: string; colorFn: (text: string) => string }[] = [
  { status: "draft", label: "draft", colorFn: chalk.gray },
  { status: "ready", label: "ready", colorFn: chalk.cyan },
  { status: "approved", label: "approved", colorFn: chalk.green },
  { status: "in-progress", label: "in-progress", colorFn: chalk.yellow },
  { status: "complete", label: "complete", colorFn: chalk.dim },
];

export interface RenderOptions {
  colWidth?: number;
  wide?: boolean;
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max - 1) + "…";
}

export function renderTerminal(specs: BoardSpec[], options: RenderOptions = {}): string {
  if (specs.length === 0) {
    return chalk.gray("No active specs found.");
  }

  const colWidth = options.colWidth || 16;
  const lines: string[] = [];

  const headerLine = COLUMNS.map(c => {
    const padded = c.label.padEnd(colWidth);
    return chalk.bold(padded);
  }).join("│");
  lines.push("┌" + "─".repeat(colWidth) + "┬" + "─".repeat(colWidth) + "┬" + "─".repeat(colWidth) + "┬" + "─".repeat(colWidth) + "┬" + "─".repeat(colWidth) + "┐");
  lines.push("│" + headerLine + "│");
  lines.push("├" + "─".repeat(colWidth) + "┼" + "─".repeat(colWidth) + "┼" + "─".repeat(colWidth) + "┼" + "─".repeat(colWidth) + "┼" + "─".repeat(colWidth) + "┤");

  const byStatus = new Map<SpecStatus, BoardSpec[]>();
  for (const c of COLUMNS) byStatus.set(c.status, []);
  for (const s of specs) {
    const arr = byStatus.get(s.status);
    if (arr) arr.push(s);
  }

  const maxRows = Math.max(...COLUMNS.map(c => byStatus.get(c.status)?.length || 0), 1);

  for (let row = 0; row < maxRows; row++) {
    const cells = COLUMNS.map(col => {
      const arr = byStatus.get(col.status) || [];
      if (row >= arr.length) return " ".repeat(colWidth);
      const spec = arr[row];
      const title = truncate(spec.title, colWidth);
      if (options.wide) {
        const info = `${title} @${spec.author}`;
        return col.colorFn(truncate(info, colWidth).padEnd(colWidth));
      }
      return col.colorFn(title.padEnd(colWidth));
    });
    lines.push("│" + cells.join("│") + "│");
  }

  lines.push("└" + "─".repeat(colWidth) + "┴" + "─".repeat(colWidth) + "┴" + "─".repeat(colWidth) + "┴" + "─".repeat(colWidth) + "┴" + "─".repeat(colWidth) + "┘");

  const counts = COLUMNS.map(c => `${c.label}: ${byStatus.get(c.status)?.length || 0}`);
  lines.push("");
  lines.push(chalk.bold(`Total: ${specs.length} specs`) + " | " + counts.join(" | "));

  return lines.join("\n");
}
