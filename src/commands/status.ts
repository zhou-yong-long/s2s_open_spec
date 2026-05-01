import type { CommandModule } from "yargs";
import { readConfig } from "../core/config.js";
import { parseSpec, type Spec } from "../core/spec.js";
import { readdirSync, existsSync } from "fs";
import { join } from "path";
import chalk from "chalk";

interface StatusArgs {
  domain?: string;
  author?: string;
  all?: boolean;
}

const STATUS_COLORS: Record<string, (s: string) => string> = {
  draft: chalk.gray,
  ready: chalk.yellow,
  approved: chalk.green,
  "in-progress": chalk.blue,
  complete: chalk.dim,
  archived: chalk.dim,
};

export const statusCommand: CommandModule<{}, StatusArgs> = {
  command: "status",
  describe: "Show all specs and their status",
  builder: (yargs) =>
    yargs
      .option("domain", { type: "string" })
      .option("author", { type: "string" })
      .option("all", { type: "boolean", describe: "Include completed/archived" }),
  handler: (argv) => {
    const cwd = process.cwd();
    const config = readConfig(cwd);
    const dirs = [config.paths.active];
    if (argv.all) dirs.push(config.paths.completed, config.paths.archived);

    const specs = findAllSpecs(dirs.map((d) => join(cwd, d)));
    let filtered = specs.filter((s) => {
      if (argv.domain && s.frontmatter.domain !== argv.domain) return false;
      if (argv.author && s.frontmatter.author !== argv.author) return false;
      return true;
    });

    if (filtered.length === 0) {
      console.log(chalk.gray("No active specs. Use `sdd new <name>` to create one."));
      return;
    }

    const order = ["draft", "ready", "approved", "in-progress", "complete", "archived"];
    filtered.sort((a, b) => {
      const sa = order.indexOf(a.frontmatter.status);
      const sb = order.indexOf(b.frontmatter.status);
      if (sa !== sb) return sa - sb;
      return a.frontmatter.created.localeCompare(b.frontmatter.created);
    });

    console.log(chalk.bold(`Active specs (${filtered.length}):\n`));
    for (const spec of filtered) {
      const fm = spec.frontmatter;
      const color = STATUS_COLORS[fm.status] ?? chalk.white;
      const domain = fm.domain ? `${fm.domain}/` : "";
      const name = spec.filePath.split("/").pop()!.replace(/^\d{4}-\d{2}-\d{2}-/, "").replace(".md", "");
      const days = Math.floor((Date.now() - new Date(fm.created).getTime()) / 86400000);
      const stale = fm.status !== "complete" && fm.status !== "archived" && days > 7;
      console.log(`${color(fm.status.padEnd(13))} ${domain}${name.padEnd(25)} ${fm.author.padEnd(12)} ${fm.created} ${stale ? chalk.red(`(${days}d stale)`) : ""}`);
    }
  },
};

function findAllSpecs(dirs: string[]): Spec[] {
  const results: Spec[] = [];
  for (const dir of dirs) {
    if (!existsSync(dir)) continue;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        results.push(...findAllSpecs([join(dir, entry.name)]));
      } else if (entry.name.endsWith(".md") && !entry.name.startsWith(".")) {
        try { results.push(parseSpec(join(dir, entry.name))); } catch { /* skip */ }
      }
    }
  }
  return results;
}
