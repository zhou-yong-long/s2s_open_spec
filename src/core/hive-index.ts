import {
  readdirSync,
  existsSync,
  readFileSync,
  mkdirSync,
  writeFileSync,
} from "fs";
import { join, basename, relative } from "path";
import yaml from "js-yaml";

const YAML_RE = /^---\n([\s\S]*?)\n---/;
const DEBOUNCE_MS = 5 * 60 * 1000;

export interface HiveDomain {
  name: string;
  description: string;
  source_files: string[];
  hive_uri: string | null;
}

export interface HiveIndex {
  version: string;
  project: string;
  last_synced: string;
  domains: HiveDomain[];
}

export interface ScanOptions {
  srcDir?: string;
  specsDir?: string;
}

/**
 * Scan src/ directory and return first-level subdirectory names as domains.
 * Only directories are considered; files at src/ root are ignored.
 */
export function scanSrcDomains(srcDir: string): string[] {
  if (!existsSync(srcDir)) return [];
  const entries = readdirSync(srcDir, { withFileTypes: true });
  return entries
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();
}

/**
 * Parse all .md files in the specs directory and extract unique domain values.
 * Specs with domain: null or missing domain are skipped.
 */
export function scanSpecDomains(specsDir: string): string[] {
  if (!existsSync(specsDir)) return [];
  const domains = new Set<string>();

  const entries = readdirSync(specsDir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory()) {
      for (const sub of scanSpecDomains(join(specsDir, entry.name))) {
        domains.add(sub);
      }
    } else if (entry.name.endsWith(".md")) {
      try {
        const content = readFileSync(join(specsDir, entry.name), "utf-8");
        const match = content.match(YAML_RE);
        if (match) {
          const parsed = yaml.load(match[1]) as Record<string, unknown>;
          const domain = parsed?.domain;
          if (domain && typeof domain === "string") {
            domains.add(domain);
          }
        }
      } catch {
        // Skip unparseable files
      }
    }
  }

  return Array.from(domains).sort();
}

/**
 * Check if the index was synced within the debounce window (5 minutes).
 */
export function shouldDebounce(lastSynced: string): boolean {
  if (!lastSynced) return false;
  const last = new Date(lastSynced).getTime();
  return Date.now() - last < DEBOUNCE_MS;
}

/**
 * Build a Hive Index by scanning src/ directories and spec frontmatter.
 * Domains from both sources are merged; src directories get file mappings.
 */
export function buildIndex(
  projectRoot: string,
  opts: ScanOptions = {}
): HiveIndex {
  const srcDir = join(projectRoot, opts.srcDir ?? "src");
  const specsDir = join(projectRoot, opts.specsDir ?? "specs/active");

  const srcDomains = scanSrcDomains(srcDir);
  const specDomains = scanSpecDomains(specsDir);

  const allDomains = new Set<string>([...srcDomains, ...specDomains]);

  const domains: HiveDomain[] = [];
  for (const name of allDomains) {
    const sourceFiles: string[] = [];
    const srcPath = join(srcDir, name);
    if (existsSync(srcPath)) {
      sourceFiles.push(...collectTsFiles(srcPath, opts.srcDir ?? "src", projectRoot));
    }

    domains.push({
      name,
      description: `Domain: ${name}`,
      source_files: sourceFiles,
      hive_uri: null,
    });
  }

  return {
    version: "1",
    project: basename(projectRoot),
    last_synced: new Date().toISOString(),
    domains,
  };
}

/**
 * Write the index to a JSON file, creating parent directories if needed.
 */
export function writeIndex(indexPath: string, index: HiveIndex): void {
  mkdirSync(join(indexPath, ".."), { recursive: true });
  writeFileSync(indexPath, JSON.stringify(index, null, 2) + "\n");
}

/**
 * Read the index from a JSON file. Returns null if file doesn't exist.
 */
export function readIndex(indexPath: string): HiveIndex | null {
  if (!existsSync(indexPath)) return null;
  try {
    const raw = readFileSync(indexPath, "utf-8");
    return JSON.parse(raw) as HiveIndex;
  } catch {
    return null;
  }
}

// --- Internal helpers ---

function collectTsFiles(dir: string, basePath: string, projectRoot: string): string[] {
  const files: string[] = [];
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectTsFiles(fullPath, basePath, projectRoot));
    } else if (entry.name.endsWith(".ts")) {
      files.push(relative(projectRoot, fullPath));
    }
  }
  return files;
}

