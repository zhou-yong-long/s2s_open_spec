import { readdirSync, existsSync, readFileSync } from "fs";
import { join } from "path";
import yaml from "js-yaml";
import type { SpecStatus } from "../core/spec.js";
import type { Config } from "../core/config.js";

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
  status?: string;
}

const VALID_STATUSES: readonly string[] = ["draft", "ready", "approved", "in-progress", "complete", "archived"];

function coerceStatus(value: unknown): SpecStatus {
  if (typeof value === "string" && VALID_STATUSES.includes(value)) {
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
  const configPath = join(projectRoot, ".sdd", "config.yaml");
  let activeDir = join(projectRoot, "specs/active");
  if (existsSync(configPath)) {
    try {
      const raw = readFileSync(configPath, "utf-8");
      const cfg = yaml.load(raw) as Partial<Config>;
      if (cfg?.paths?.active) {
        activeDir = join(projectRoot, cfg.paths.active);
      }
    } catch { /* use default */ }
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

  if (options?.domain) {
    return specs.filter(s => s.domain === options.domain);
  }
  if (options?.author) {
    return specs.filter(s => s.author === options.author);
  }
  if (options?.status) {
    return specs.filter(s => s.status === options.status);
  }
  return specs;
}
