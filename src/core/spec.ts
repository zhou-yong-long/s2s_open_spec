import { readFileSync, writeFileSync } from "fs";
import yaml from "js-yaml";

export const SPEC_STATUSES = ["draft", "ready", "approved", "in-progress", "complete", "archived"] as const;
export type SpecStatus = (typeof SPEC_STATUSES)[number];

export interface SpecFrontmatter {
  status: SpecStatus;
  author: string;
  created: string;
  domain: string | null;
  tags: string[];
  links: { parent: string | null; related: string[] };
  pinned_commit: string | null;
  linked_files: string[];
}

export interface ChangelogEntry {
  date: string;
  change: string;
  author: string;
}

export interface Spec {
  filePath: string;
  frontmatter: SpecFrontmatter;
  body: string;
  changelog: ChangelogEntry[];
}

const YAML_RE = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/;

export function parseSpec(filePath: string): Spec {
  const content = readFileSync(filePath, "utf-8");
  const match = content.match(YAML_RE);

  let frontmatter: SpecFrontmatter;
  let body: string;

  if (match) {
    const parsed = yaml.load(match[1]) as Partial<SpecFrontmatter>;
    frontmatter = {
      status: parsed?.status ?? "draft",
      author: parsed?.author ?? "",
      created: parsed?.created ?? "",
      domain: parsed?.domain ?? null,
      tags: parsed?.tags ?? [],
      links: parsed?.links ?? { parent: null, related: [] },
      pinned_commit: parsed?.pinned_commit ?? null,
      linked_files: parsed?.linked_files ?? [],
    };
    body = match[2];
  } else {
    frontmatter = { status: "draft", author: "", created: "", domain: null, tags: [], links: { parent: null, related: [] }, pinned_commit: null, linked_files: [] };
    body = content;
  }

  return { filePath, frontmatter, body, changelog: parseChangelog(body) };
}

export function updateFrontmatter(filePath: string, updates: Partial<SpecFrontmatter>): void {
  const spec = parseSpec(filePath);
  const merged = { ...spec.frontmatter, ...updates };
  const yamlStr = yaml.dump(merged, { indent: 2, lineWidth: 120 });
  const newContent = `---\n${yamlStr}---\n${spec.body}`;
  writeFileSync(filePath, newContent);
}

export function appendChangelog(filePath: string, entry: ChangelogEntry): void {
  const content = readFileSync(filePath, "utf-8");
  const row = `| ${entry.date} | ${entry.change} | ${entry.author} |\n`;
  const lines = content.split("\n");
  for (let i = lines.length - 1; i >= 0; i--) {
    if (lines[i].startsWith("| ") && lines[i].includes(" | ")) {
      lines.splice(i + 1, 0, row);
      writeFileSync(filePath, lines.join("\n"));
      return;
    }
  }
  writeFileSync(filePath, content + `\n## Changelog\n\n| Date | Change | Author |\n|------|--------|--------|\n${row}`);
}

function parseChangelog(body: string): ChangelogEntry[] {
  const entries: ChangelogEntry[] = [];
  const section = body.match(/## Changelog\n([\s\S]*?)(?:\n##|$)/);
  if (!section) return entries;
  const rows = section[1].matchAll(/\| (\d{4}-\d{2}-\d{2}) \| (.+?) \| (.+?) \|/g);
  for (const row of rows) {
    if (row[1] === "Date" || row[1].includes("---")) continue;
    entries.push({ date: row[1], change: row[2].trim(), author: row[3].trim() });
  }
  return entries;
}
