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

export interface ReviewEntry {
  date: string;
  reviewer: string;
  decision: string;
  notes: string;
}

export interface ReviewThread {
  index: number;
  resolved: boolean;
  title: string;
  reviewer: string;
  created: string;
  section: string;
  comment: string;
  response: string | null;
  responseDate: string | null;
}

export interface Spec {
  filePath: string;
  frontmatter: SpecFrontmatter;
  body: string;
  changelog: ChangelogEntry[];
  reviewThreads: ReviewThread[];
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

  return { filePath, frontmatter, body, changelog: parseChangelog(body), reviewThreads: parseReviewThreads(body) };
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

export function appendReviewLog(filePath: string, entry: ReviewEntry): void {
  const content = readFileSync(filePath, "utf-8");
  const row = `| ${entry.date} | ${entry.reviewer} | ${entry.decision} | ${entry.notes} |\n`;
  const lines = content.split("\n");

  // Find the Review Log table and append after last data row
  let inReviewLog = false;
  let lastDataRow = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith("## Review Log")) {
      inReviewLog = true;
      continue;
    }
    if (inReviewLog) {
      if (lines[i].startsWith("## ")) break;
      if (lines[i].startsWith("| ") && !lines[i].includes("---") && !lines[i].includes("Date")) {
        lastDataRow = i;
      }
    }
  }

  if (lastDataRow > 0) {
    lines.splice(lastDataRow + 1, 0, row);
    writeFileSync(filePath, lines.join("\n"));
  } else {
    // No Review Log section, or only header — find insertion point
    const reviewLogIdx = lines.findIndex(l => l.startsWith("## Review Log"));
    if (reviewLogIdx >= 0) {
      // Find the separator line after header
      for (let i = reviewLogIdx + 1; i < lines.length; i++) {
        if (lines[i].includes("---") && lines[i].includes("|")) {
          lines.splice(i + 1, 0, row);
          writeFileSync(filePath, lines.join("\n"));
          return;
        }
      }
    }
    // No Review Log section at all — append one
    const section = `\n## Review Log\n\n| Date | Reviewer | Decision | Notes |\n|------|----------|----------|-------|\n${row}`;
    writeFileSync(filePath, content + section);
  }
}

export function appendReviewThread(filePath: string, thread: Omit<ReviewThread, "index" | "resolved" | "response" | "responseDate">): void {
  const content = readFileSync(filePath, "utf-8");
  const existingThreads = parseReviewThreads(readFileSync(filePath, "utf-8"));
  const nextIndex = existingThreads.length > 0 ? Math.max(...existingThreads.map(t => t.index)) + 1 : 1;

  const threadBlock = [
    `### [ ] ${thread.title}`,
    `**Reviewer:** ${thread.reviewer} | **Created:** ${thread.created} | **Section:** ${thread.section}`,
    `> ${thread.comment}`,
    "",
  ].join("\n");

  // Find ## Review Threads section
  const threadsHeader = /## Review Threads\n/;
  const match = content.match(threadsHeader);

  if (match && match.index !== undefined) {
    // Append after the last thread block, before next ## section
    const afterHeader = match.index! + match[0].length;
    const rest = content.slice(afterHeader);
    const nextSection = rest.match(/\n## /);
    if (nextSection && nextSection.index !== undefined) {
      const insertAt = afterHeader + nextSection.index!;
      const newContent = content.slice(0, insertAt) + "\n" + threadBlock + "\n" + content.slice(insertAt);
      writeFileSync(filePath, newContent);
    } else {
      writeFileSync(filePath, content + "\n" + threadBlock + "\n");
    }
  } else {
    // No Review Threads section — append one before Changelog or at end
    const changelogIdx = content.indexOf("\n## Changelog\n");
    if (changelogIdx >= 0) {
      const section = `\n## Review Threads\n\n${threadBlock}\n`;
      const newContent = content.slice(0, changelogIdx) + section + content.slice(changelogIdx);
      writeFileSync(filePath, newContent);
    } else {
      const section = `\n## Review Threads\n\n${threadBlock}\n`;
      writeFileSync(filePath, content + section);
    }
  }
}

export function resolveThread(filePath: string, threadIndex: number, response: string): boolean {
  const content = readFileSync(filePath, "utf-8");

  // Match the thread header: ### [ ] title
  const threadPattern = new RegExp(
    `(### \\[ \\] .*?\\n(?:\\*\\*.*?\\*\\*\\n|> .*?\\n|\\n)*)`,
    "g"
  );
  const matches = content.match(threadPattern);

  const openThreads = parseReviewThreads(content).filter(t => !t.resolved);
  if (threadIndex < 0 || threadIndex >= openThreads.length) return false;

  const target = openThreads[threadIndex];
  const today = new Date().toISOString().slice(0, 10);

  // Replace [ ] with [x] and add response
  const oldBlock = `### [ ] ${target.title}`;
  const newBlock = `### [x] ${target.title}\n**Reviewer:** ${target.reviewer} | **Created:** ${target.created} | **Section:** ${target.section}\n> ${target.comment}\n\n**Response (${today}):** ${response}`;

  // Build a more specific regex for the actual block replacement
  const escapedTitle = target.title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const escapedBlock = `### \\[ \\] ${escapedTitle}[\\s\\S]*?(?=\\n### |\\n## |$)`;
  const blockRegex = new RegExp(escapedBlock);

  if (blockRegex.test(content)) {
    const updated = content.replace(blockRegex, newBlock);
    writeFileSync(filePath, updated);
    return true;
  }
  return false;
}

export function getOpenThreads(filePath: string): ReviewThread[] {
  const content = readFileSync(filePath, "utf-8");
  return parseReviewThreads(content).filter(t => !t.resolved);
}

export function parseReviewThreads(body: string): ReviewThread[] {
  const threads: ReviewThread[] = [];
  const section = body.match(/## Review Threads\n([\s\S]*?)(?:\n## |$)/);
  if (!section) return threads;

  // Split by thread headers: ### [ ] or ### [x]
  const threadBlocks = section[1].split(/\n### (?=\[.\])/);
  let idx = 0;

  for (const block of threadBlocks) {
    if (!block.trim()) continue;

    // Prepend the "### " that got consumed by split for blocks after the first
    const fullBlock = block.startsWith("[") ? `### ${block}` : block;
    if (!fullBlock.startsWith("### [")) continue;

    const resolved = fullBlock.startsWith("### [x]");
    const lines = fullBlock.split("\n");

    // Extract title from first line: ### [x] Title
    const titleMatch = lines[0].match(/### \[.\]\s+(.+)/);
    if (!titleMatch) continue;
    const title = titleMatch[1].trim();

    let reviewer = "";
    let created = "";
    let sectionName = "";
    let comment = "";
    let response: string | null = null;
    let responseDate: string | null = null;

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      // Metadata line
      const metaMatch = line.match(/\*\*Reviewer:\*\*\s*(.+?)\s*\|\s*\*\*Created:\*\*\s*(.+?)\s*\|\s*\*\*Section:\*\*\s*(.+)/);
      if (metaMatch) {
        reviewer = metaMatch[1].trim();
        created = metaMatch[2].trim();
        sectionName = metaMatch[3].trim();
        continue;
      }
      // Comment line (blockquote)
      if (line.startsWith("> ")) {
        comment = line.slice(2).trim();
        continue;
      }
      // Response line
      const respMatch = line.match(/\*\*Response\s*\((.+?)\):\*\*\s*(.+)/);
      if (respMatch) {
        responseDate = respMatch[1].trim();
        response = respMatch[2].trim();
        continue;
      }
    }

    threads.push({
      index: ++idx,
      resolved,
      title,
      reviewer,
      created,
      section: sectionName,
      comment,
      response,
      responseDate,
    });
  }

  return threads;
}
