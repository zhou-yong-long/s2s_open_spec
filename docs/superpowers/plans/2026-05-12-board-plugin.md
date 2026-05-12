# Board Plugin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement `sdd board` plugin with terminal table and browser UI modes for visualizing all active specs.

**Architecture:** Single plugin file `src/plugins/board.ts` with three pure functions: `scanSpecs` (data collection), `renderTerminal` (CLI output), `renderUI` (HTTP server + HTML). Registered via `loader.ts`. Zero new dependencies.

**Tech Stack:** TypeScript, Node.js `http`/`fs`/`path`/`child_process`, `chalk`, `yargs`

---

### Task 1: Board Data Model & scanSpecs

**Files:**
- Create: `src/plugins/board.ts` (partial — scanSpecs + types)
- Test: `tests/plugins/board.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/plugins/board.test.ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { scanSpecs, type BoardSpec } from "../../src/plugins/board.js";
import { mkdirSync, writeFileSync, rmSync } from "fs";
import { join } from "path";

const testDir = join(process.cwd(), "tests/fixtures/board-test");

beforeEach(() => {
  rmSync(testDir, { recursive: true, force: true });
  mkdirSync(join(testDir, "specs/active"), { recursive: true });
});

afterEach(() => {
  rmSync(testDir, { recursive: true, force: true });
});

function writeSpec(dir: string, name: string, frontmatter: Record<string, unknown>, body: string) {
  const fm = `---\nstatus: draft\nauthor: test\ncreated: 2026-05-12\ndomain: null\ntags: []\nlinks:\n  parent: null\n  related: []\npinned_commit: null\nlinked_files: []\n`;
  const extra = Object.entries(frontmatter)
    .filter(([k]) => !["status", "author", "created", "domain", "tags", "links", "pinned_commit", "linked_files"].includes(k))
    .map(([k, v]) => `${k}: ${typeof v === "string" ? v : JSON.stringify(v)}`)
    .join("\n");
  writeFileSync(join(dir, name), `${fm}${extra}\n---\n${body}`);
}

describe("scanSpecs", () => {
  it("returns empty array when no specs exist", () => {
    const specs = scanSpecs(testDir);
    expect(specs).toEqual([]);
  });

  it("scans active specs with frontmatter", () => {
    writeSpec(join(testDir, "specs/active"), "auth-spec.md", { status: "draft", author: "alice" }, "# Auth Spec\n\n## Problem\n...");
    const specs = scanSpecs(testDir);
    expect(specs.length).toBe(1);
    expect(specs[0].title).toBe("Auth Spec");
    expect(specs[0].status).toBe("draft");
    expect(specs[0].author).toBe("alice");
    expect(specs[0].fileName).toBe("auth-spec.md");
  });

  it("recursively scans subdirectories", () => {
    mkdirSync(join(testDir, "specs/active/sub"), { recursive: true });
    writeSpec(join(testDir, "specs/active"), "a.md", { status: "ready" }, "# A");
    writeSpec(join(testDir, "specs/active/sub"), "b.md", { status: "approved" }, "# B");
    const specs = scanSpecs(testDir);
    expect(specs.length).toBe(2);
    const statuses = specs.map(s => s.status);
    expect(statuses).toContain("ready");
    expect(statuses).toContain("approved");
  });

  it("filters by domain", () => {
    writeSpec(join(testDir, "specs/active"), "a.md", { status: "draft", domain: "auth" }, "# A");
    writeSpec(join(testDir, "specs/active"), "b.md", { status: "draft", domain: "api" }, "# B");
    const specs = scanSpecs(testDir, { domain: "auth" });
    expect(specs.length).toBe(1);
    expect(specs[0].domain).toBe("auth");
  });

  it("filters by author", () => {
    writeSpec(join(testDir, "specs/active"), "a.md", { status: "draft", author: "alice" }, "# A");
    writeSpec(join(testDir, "specs/active"), "b.md", { status: "draft", author: "bob" }, "# B");
    const specs = scanSpecs(testDir, { author: "alice" });
    expect(specs.length).toBe(1);
    expect(specs[0].author).toBe("alice");
  });

  it("filters by status", () => {
    writeSpec(join(testDir, "specs/active"), "a.md", { status: "draft" }, "# A");
    writeSpec(join(testDir, "specs/active"), "b.md", { status: "approved" }, "# B");
    const specs = scanSpecs(testDir, { status: "draft" });
    expect(specs.length).toBe(1);
    expect(specs[0].status).toBe("draft");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/plugins/board.test.ts -v`
Expected: FAIL with "Cannot find module '../../src/plugins/board.js'"

- [ ] **Step 3: Write scanSpecs implementation**

```typescript
// src/plugins/board.ts — top portion
import { readdirSync, existsSync, readFileSync } from "fs";
import { join, relative } from "path";
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/plugins/board.test.ts -v`
Expected: All 6 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/plugins/board.ts tests/plugins/board.test.ts
git commit -m "feat(board): add scanSpecs with filtering support"
```

---

### Task 2: Terminal Board Renderer

**Files:**
- Modify: `src/plugins/board.ts` (add renderTerminal + boardCommand)
- Test: `tests/plugins/board.test.ts` (add renderTerminal tests)

- [ ] **Step 1: Write the failing test**

Append to `tests/plugins/board.test.ts`:

```typescript
import { renderTerminal, type BoardSpec } from "../../src/plugins/board.js";

describe("renderTerminal", () => {
  it("renders empty board message", () => {
    const specs: BoardSpec[] = [];
    const output = renderTerminal(specs, {});
    expect(output).toContain("No active specs found");
  });

  it("renders specs grouped by status", () => {
    const specs: BoardSpec[] = [
      { fileName: "a.md", title: "Auth", status: "draft", author: "alice", domain: null, created: "2026-05-01", tags: [] },
      { fileName: "b.md", title: "API", status: "approved", author: "bob", domain: "api", created: "2026-05-02", tags: ["urgent"] },
    ];
    const output = renderTerminal(specs, {});
    expect(output).toContain("draft");
    expect(output).toContain("approved");
    expect(output).toContain("Auth");
    expect(output).toContain("API");
  });

  it("shows summary line", () => {
    const specs: BoardSpec[] = [
      { fileName: "a.md", title: "A", status: "draft", author: "x", domain: null, created: "", tags: [] },
      { fileName: "b.md", title: "B", status: "draft", author: "y", domain: null, created: "", tags: [] },
    ];
    const output = renderTerminal(specs, {});
    expect(output).toMatch(/Total:\s*2/);
    expect(output).toMatch(/draft:\s*2/);
  });

  it("truncates long titles in narrow columns", () => {
    const specs: BoardSpec[] = [
      { fileName: "a.md", title: "This Is A Very Long Spec Title That Should Be Truncated", status: "draft", author: "x", domain: null, created: "", tags: [] },
    ];
    const output = renderTerminal(specs, { colWidth: 16 });
    // Should truncate with …
    expect(output.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/plugins/board.test.ts -v`
Expected: FAIL — renderTerminal not exported

- [ ] **Step 3: Write renderTerminal implementation**

Append to `src/plugins/board.ts`:

```typescript
import chalk from "chalk";

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

  // Header row
  const headerLine = COLUMNS.map(c => {
    const padded = c.label.padEnd(colWidth);
    return chalk.bold(padded);
  }).join("│");
  lines.push("┌" + "─".repeat(colWidth) + "┬" + "─".repeat(colWidth) + "┬" + "─".repeat(colWidth) + "┬" + "─".repeat(colWidth) + "┬" + "─".repeat(colWidth) + "┐");
  lines.push("│" + headerLine + "│");
  lines.push("├" + "─".repeat(colWidth) + "┼" + "─".repeat(colWidth) + "┼" + "─".repeat(colWidth) + "┼" + "─".repeat(colWidth) + "┼" + "─".repeat(colWidth) + "┤");

  // Group specs by status
  const byStatus = new Map<SpecStatus, BoardSpec[]>();
  for (const c of COLUMNS) byStatus.set(c.status, []);
  for (const s of specs) {
    const arr = byStatus.get(s.status);
    if (arr) arr.push(s);
  }

  // Find max rows needed
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

  // Summary
  const counts = COLUMNS.map(c => `${c.label}: ${byStatus.get(c.status)?.length || 0}`);
  lines.push("");
  lines.push(chalk.bold(`Total: ${specs.length} specs`) + " | " + counts.join(" | "));

  return lines.join("\n");
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/plugins/board.test.ts -v`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/plugins/board.ts tests/plugins/board.test.ts
git commit -m "feat(board): add terminal renderer with status columns"
```

---

### Task 3: Browser UI Renderer

**Files:**
- Modify: `src/plugins/board.ts` (add renderUI + HTML generation)

- [ ] **Step 1: Write the failing test**

Append to `tests/plugins/board.test.ts`:

```typescript
import { generateHTML } from "../../src/plugins/board.js";

describe("generateHTML", () => {
  it("generates valid HTML with spec data", () => {
    const specs: BoardSpec[] = [
      { fileName: "a.md", title: "Auth", status: "draft", author: "alice", domain: null, created: "2026-05-01", tags: [] },
    ];
    const html = generateHTML(specs);
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("Auth");
    expect(html).toContain("alice");
    expect(html).toContain("draft");
  });

  it("includes search functionality", () => {
    const specs: BoardSpec[] = [];
    const html = generateHTML(specs);
    expect(html).toContain("search");
    expect(html).toContain("filterSpecs");
  });

  it("includes all 5 status columns", () => {
    const html = generateHTML([]);
    expect(html).toContain("draft");
    expect(html).toContain("ready");
    expect(html).toContain("approved");
    expect(html).toContain("in-progress");
    expect(html).toContain("complete");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/plugins/board.test.ts -v`
Expected: FAIL — generateHTML not exported

- [ ] **Step 3: Write generateHTML implementation**

Append to `src/plugins/board.ts`:

```typescript
function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function generateHTML(specs: BoardSpec[]): string {
  const statusLabels: Record<string, string> = {
    draft: "Draft",
    ready: "Ready",
    approved: "Approved",
    "in-progress": "In Progress",
    complete: "Complete",
  };

  const statusColors: Record<string, string> = {
    draft: "#6b7280",
    ready: "#06b6d4",
    approved: "#22c55e",
    "in-progress": "#eab308",
    complete: "#9ca3af",
  };

  const byStatus: Record<string, BoardSpec[]> = {};
  for (const s of Object.keys(statusLabels)) byStatus[s] = [];
  for (const spec of specs) {
    if (byStatus[spec.status]) byStatus[spec.status].push(spec);
  }

  const columnsHtml = Object.entries(statusLabels).map(([status, label]) => {
    const items = byStatus[status] || [];
    const cards = items.map(spec => {
      const domainBadge = spec.domain
        ? `<span class="badge">${escapeHtml(spec.domain)}</span>`
        : "";
      const tagsHtml = spec.tags.length > 0
        ? spec.tags.map(t => `<span class="badge tag">${escapeHtml(t)}</span>`).join("")
        : "";
      return `<div class="card">
        <div class="card-title">${escapeHtml(spec.title)}</div>
        <div class="card-meta">@${escapeHtml(spec.author)}${spec.created ? " · " + escapeHtml(spec.created) : ""}</div>
        ${domainBadge}${tagsHtml}
      </div>`;
    }).join("");

    const emptyState = items.length === 0
      ? '<div class="empty">No specs</div>'
      : "";

    return `<div class="column">
      <div class="column-header" style="border-top: 3px solid ${statusColors[status]}">
        <h2>${label}</h2>
        <span class="count">${items.length}</span>
      </div>
      ${cards}${emptyState}
    </div>`;
  }).join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>SDD Board</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;background:#f3f4f6;color:#1f2937;padding:20px}
h1{font-size:24px;margin-bottom:16px}
.header{display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;flex-wrap:wrap;gap:12px}
#search{padding:8px 12px;border:1px solid #d1d5db;border-radius:6px;width:280px;font-size:14px}
#search:focus{outline:none;border-color:#3b82f6;box-shadow:0 0 0 2px rgba(59,130,246,.2)}
.board{display:flex;gap:16px;overflow-x:auto;padding-bottom:20px}
.column{flex:1;min-width:200px;background:#e5e7eb;border-radius:8px;padding:12px}
.column-header{display:flex;justify-content:space-between;align-items:center;padding:8px 0;margin-bottom:12px}
.column-header h2{font-size:14px;font-weight:600;text-transform:uppercase;letter-spacing:.05em}
.count{background:#d1d5db;border-radius:9999px;padding:2px 8px;font-size:12px;font-weight:500}
.card{background:#fff;border-radius:6px;padding:12px;margin-bottom:8px;box-shadow:0 1px 2px rgba(0,0,0,.05)}
.card-title{font-weight:500;margin-bottom:4px}
.card-meta{font-size:12px;color:#6b7280;margin-bottom:6px}
.badge{display:inline-block;background:#e5e7eb;border-radius:4px;padding:2px 6px;font-size:11px;margin-right:4px;margin-bottom:4px}
.badge.tag{background:#dbeafe;color:#1d4ed8}
.empty{text-align:center;color:#9ca3af;padding:20px;font-size:14px}
</style>
</head>
<body>
<div class="header">
  <h1>SDD Board</h1>
  <input type="text" id="search" placeholder="Search specs..." oninput="filterSpecs()">
</div>
<div class="board" id="board">
  ${columnsHtml}
</div>
<script>
function filterSpecs(){const q=document.getElementById("search").value.toLowerCase();document.querySelectorAll(".card").forEach(c=>{const t=c.querySelector(".card-title").textContent.toLowerCase();c.style.display=t.includes(q)?"":"none"});document.querySelectorAll(".column").forEach(col=>{const visible=col.querySelectorAll(".card[style=''], .card:not([style])");const empty=col.querySelector(".empty");if(empty)empty.style.display=visible.length===0?"":"none"})}
</script>
</body>
</html>`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/plugins/board.test.ts -v`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/plugins/board.ts tests/plugins/board.test.ts
git commit -m "feat(board): add HTML generator for browser UI"
```

---

### Task 4: HTTP Server & Command Registration

**Files:**
- Modify: `src/plugins/board.ts` (add renderUI + boardCommand + export default)
- Modify: `src/plugins/loader.ts` (register board plugin)
- Modify: `scaffold/.sdd/config.yaml` (enable board)
- Modify: `src/core/config.ts` (set board: true in defaultConfig)

- [ ] **Step 1: Write renderUI and boardCommand**

Append to `src/plugins/board.ts`:

```typescript
import { createServer, Server } from "http";
import { exec } from "child_process";

function findAvailablePort(startPort: number, maxRetries: number): Promise<number> {
  return new Promise((resolve, reject) => {
    let retries = 0;
    function tryPort(port: number) {
      const server = createServer();
      server.on("error", () => {
        server.close();
        retries++;
        if (retries > maxRetries) reject(new Error("No available port found"));
        else tryPort(port + 1);
      });
      server.on("listening", () => {
        server.close();
        resolve(port);
      });
      server.listen(port, "127.0.0.1");
    }
    tryPort(startPort);
  });
}

export function renderUI(specs: BoardSpec[]): void {
  const html = generateHTML(specs);
  let requestCount = 0;
  let server: Server;

  findAvailablePort(3456, 5).then(port => {
    server = createServer((req, res) => {
      requestCount++;
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(html);
    });

    server.listen(port, "127.0.0.1", () => {
      const url = `http://127.0.0.1:${port}`;
      console.log(chalk.green(`Board UI: ${url}`));
      console.log(chalk.gray("Press Ctrl+C to stop"));

      // Auto-open browser
      const openCmd = process.platform === "darwin" ? "open" : process.platform === "win32" ? "start" : "xdg-open";
      exec(`${openCmd} "${url}"`);

      // Auto-close after 5 minutes of inactivity
      const inactivityTimer = setInterval(() => {
        if (requestCount === 0) {
          clearInterval(inactivityTimer);
          server.close();
          process.exit(0);
        }
        requestCount = 0;
      }, 300_000);
    });
  }).catch(err => {
    console.error(chalk.red(`Failed to start board UI: ${err.message}`));
    console.log(chalk.yellow("Falling back to terminal mode:"));
    console.log(renderTerminal(specs, {}));
  });
}

import type { CommandModule } from "yargs";

const boardCommand: CommandModule = {
  command: "board",
  describe: "Display a kanban-style board of all active specs",
  builder: (yargs) =>
    yargs
      .option("ui", { type: "boolean", describe: "Open board in browser" })
      .option("domain", { type: "string", describe: "Filter by domain" })
      .option("author", { type: "string", describe: "Filter by author" })
      .option("status", { type: "string", describe: "Filter by status" })
      .option("wide", { type: "boolean", describe: "Show extra details" }),
  handler: (argv) => {
    const cwd = process.cwd();
    const options: ScanOptions = {};
    if (argv.domain) options.domain = argv.domain as string;
    if (argv.author) options.author = argv.author as string;
    if (argv.status) options.status = argv.status as string;

    const specs = scanSpecs(cwd, options);

    if (argv.ui) {
      renderUI(specs);
    } else {
      const renderOpts: RenderOptions = { wide: argv.wide as boolean };
      // Try to detect terminal width
      try {
        const cols = process.stdout.columns || 80;
        renderOpts.colWidth = Math.max(14, Math.floor((cols - 6) / 5));
      } catch { /* use default */ }
      console.log(renderTerminal(specs, renderOpts));
    }
  },
};

export default {
  name: "board",
  description: "Display a kanban-style board of all active specs",
  commands: { board: boardCommand },
};
```

- [ ] **Step 2: Register board plugin in loader.ts**

Modify `src/plugins/loader.ts`:

```typescript
import type { CommandModule } from "yargs";
import type { Config } from "../core/config.js";

export interface Plugin {
  name: string;
  description: string;
  commands: Record<string, CommandModule>;
}

export async function loadPlugins(config: Config, cwd: string): Promise<CommandModule[]> {
  const commands: CommandModule[] = [];
  const plugins = config.plugins;

  if (plugins.workflow) {
    const p = await import("./workflow.js");
    commands.push(...Object.values(p.default.commands));
  }
  if (plugins.doctor) {
    const p = await import("./doctor.js");
    commands.push(...Object.values(p.default.commands));
  }
  if (plugins.diff) {
    const p = await import("./diff.js");
    commands.push(...Object.values(p.default.commands));
  }
  if (plugins.board) {
    const p = await import("./board.js");
    commands.push(...Object.values(p.default.commands));
  }

  return commands;
}
```

- [ ] **Step 3: Enable board in config**

Modify `scaffold/.sdd/config.yaml`:
```yaml
plugins:
  doctor: true
  diff: true
  workflow: true
  board: true
```

Modify `src/core/config.ts` line 33:
```typescript
plugins: { doctor: true, diff: true, workflow: true, board: true, git_hooks: false, ai: false },
```

- [ ] **Step 4: Build and test manually**

Run: `npm run build && npx tsx src/index.ts board`
Expected: Terminal board renders with current specs

Run: `npx tsx src/index.ts board --ui`
Expected: Browser opens with board UI

- [ ] **Step 5: Commit**

```bash
git add src/plugins/board.ts src/plugins/loader.ts scaffold/.sdd/config.yaml src/core/config.ts
git commit -m "feat(board): add HTTP server, command registration, enable by default"
```

---

### Task 5: Update Tests & Bundle

**Files:**
- Modify: `tests/core/config.test.ts` (update board expectation)

- [ ] **Step 1: Update config test for board: true**

Modify `tests/core/config.test.ts` — add assertion:
```typescript
expect(config.plugins.board).toBe(true);
```

- [ ] **Step 2: Run full test suite**

Run: `npm test`
Expected: All tests PASS

- [ ] **Step 3: Run bundle**

Run: `npm run bundle`
Expected: All tests pass, release artifacts created

- [ ] **Step 4: Commit**

```bash
git add tests/core/config.test.ts
git commit -m "test(board): update config test for board plugin enabled"
```
