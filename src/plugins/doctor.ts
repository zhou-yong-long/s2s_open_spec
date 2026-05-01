import type { CommandModule } from "yargs";
import { readConfig } from "../core/config.js";
import { parseSpec } from "../core/spec.js";
import { readdirSync, existsSync } from "fs";
import { join } from "path";
import chalk from "chalk";

export interface SpecSummary {
  filePath: string;
  title: string;
  domain: string | null;
  author: string;
  problemWords: string[];
}

export function computeDomainGroups(specs: SpecSummary[]): Record<string, number> {
  const groups: Record<string, number> = {};
  for (const s of specs) {
    const d = s.domain || "uncategorized";
    groups[d] = (groups[d] || 0) + 1;
  }
  return groups;
}

export function detectDuplicates(specs: SpecSummary[], threshold: number): { a: SpecSummary; b: SpecSummary; score: number }[] {
  const results: { a: SpecSummary; b: SpecSummary; score: number }[] = [];
  for (let i = 0; i < specs.length; i++) {
    for (let j = i + 1; j < specs.length; j++) {
      const score = jaccardSimilarity(specs[i].problemWords, specs[j].problemWords);
      if (score >= threshold) {
        results.push({ a: specs[i], b: specs[j], score });
      }
    }
  }
  return results;
}

function jaccardSimilarity(a: string[], b: string[]): number {
  const setA = new Set(a);
  const setB = new Set(b);
  const intersection = new Set([...setA].filter((x) => setB.has(x)));
  const union = new Set([...setA, ...setB]);
  return union.size === 0 ? 0 : intersection.size / union.size;
}

function tokenize(s: string): string[] {
  return s.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 2);
}

const doctorCommand: CommandModule = {
  command: "doctor",
  describe: "Check project health and suggest improvements",
  handler: () => {
    const cwd = process.cwd();
    const config = readConfig(cwd);
    const activeDir = join(cwd, config.paths.active);
    const specs = findAllSpecSummaries(activeDir);

    console.log(chalk.bold(`Doctor check — ${specs.length} active specs\n`));

    if (specs.length >= config.doctor.flat_max && config.mode === "flat") {
      console.log(chalk.yellow(`  ${specs.length} active specs (threshold: ${config.doctor.flat_max})`));
      console.log(chalk.yellow(`  Suggestion: switch to domain mode.\n`));
    }

    const groups = computeDomainGroups(specs);
    const domainCount = Object.keys(groups).filter((d) => d !== "uncategorized").length;
    if (domainCount >= 3 && config.mode === "flat") {
      console.log(chalk.yellow(`  ${domainCount} domains detected. Suggestion: switch to domain mode.\n`));
    }

    const dupes = detectDuplicates(specs, config.doctor.similarity_threshold);
    if (dupes.length > 0) {
      console.log(chalk.red(`  ${dupes.length} potential duplicate(s) detected:`));
      for (const d of dupes) {
        console.log(chalk.red(`    "${d.a.title}" ↔ "${d.b.title}" (${d.score.toFixed(2)})`));
      }
    }

    if (specs.length < config.doctor.flat_max && domainCount < 3 && dupes.length === 0) {
      console.log(chalk.green("  All good! No issues detected."));
    }
  },
};

function findAllSpecSummaries(dir: string): SpecSummary[] {
  if (!existsSync(dir)) return [];
  const results: SpecSummary[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      results.push(...findAllSpecSummaries(join(dir, entry.name)));
    } else if (entry.name.endsWith(".md") && !entry.name.startsWith(".")) {
      try {
        const spec = parseSpec(join(dir, entry.name));
        const probMatch = spec.body.match(/## Problem\n([\s\S]*?)(?:\n##|$)/);
        const problemText = probMatch ? probMatch[1] : "";
        results.push({
          filePath: spec.filePath,
          title: spec.body.split("\n")[0]?.replace(/^# /, "") || entry.name,
          domain: spec.frontmatter.domain,
          author: spec.frontmatter.author,
          problemWords: tokenize(problemText),
        });
      } catch { /* skip */ }
    }
  }
  return results;
}

export default {
  name: "doctor",
  description: "Check project health and suggest improvements",
  commands: { doctor: doctorCommand },
};
