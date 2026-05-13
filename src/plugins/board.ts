import { readdirSync, existsSync, readFileSync } from "fs";
import { join } from "path";
import yaml from "js-yaml";
import chalk from "chalk";
import { createServer, Server } from "http";
import { exec } from "child_process";
import type { CommandModule } from "yargs";
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
    const bodyLines = match[2].split("\n");
    const firstNonEmpty = bodyLines.find(l => l.trim() !== "") || "";
    const title = firstNonEmpty.replace(/^# /, "").trim() || "Untitled";
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
  const sep = "─".repeat(colWidth);
  lines.push("┌" + COLUMNS.map(() => sep).join("┬") + "┐");
  lines.push("│" + headerLine + "│");
  lines.push("├" + COLUMNS.map(() => sep).join("┼") + "┤");

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
      if (options.wide) {
        const info = `${spec.title} @${spec.author}`;
        return col.colorFn(truncate(info, colWidth).padEnd(colWidth));
      }
      const title = truncate(spec.title, colWidth);
      return col.colorFn(title.padEnd(colWidth));
    });
    lines.push("│" + cells.join("│") + "│");
  }

  lines.push("└" + COLUMNS.map(() => sep).join("┴") + "┘");

  const counts = COLUMNS.map(c => `${c.label}: ${byStatus.get(c.status)?.length || 0}`);
  lines.push("");
  lines.push(chalk.bold(`Total: ${specs.length} specs`) + " | " + counts.join(" | "));

  return lines.join("\n");
}

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

    return `<div class="column" data-status="${status}">
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
  let inactivityTimer: NodeJS.Timeout | null = null;
  let server: Server;

  function resetInactivityTimer(srv: Server) {
    if (inactivityTimer) clearInterval(inactivityTimer);
    inactivityTimer = setInterval(() => {
      clearInterval(inactivityTimer!);
      srv.close();
      process.exit(0);
    }, 300_000);
  }

  findAvailablePort(3456, 5).then(port => {
    server = createServer((req, res) => {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(html);
      resetInactivityTimer(server);
    });

    server.listen(port, "127.0.0.1", () => {
      const url = `http://127.0.0.1:${port}`;
      console.log(chalk.green(`Board UI: ${url}`));
      console.log(chalk.gray("Press Ctrl+C to stop"));

      const openCmd = process.platform === "darwin" ? "open" : process.platform === "win32" ? "start" : "xdg-open";
      exec(`${openCmd} "${url}"`);

      resetInactivityTimer(server);
    });

    process.on("SIGINT", () => {
      server.close();
      process.exit(0);
    });
  }).catch(err => {
    console.error(chalk.red(`Failed to start board UI: ${err.message}`));
    console.log(chalk.yellow("Falling back to terminal mode:"));
    console.log(renderTerminal(specs, {}));
  });
}

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
    if (argv.status) options.status = argv.status as SpecStatus;

    const specs = scanSpecs(cwd, options);

    if (argv.ui) {
      renderUI(specs);
    } else {
      const renderOpts: RenderOptions = { wide: argv.wide as boolean };
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
