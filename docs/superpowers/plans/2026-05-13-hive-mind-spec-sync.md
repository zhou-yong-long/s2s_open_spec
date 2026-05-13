# Hive Mind Spec Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `sdd sync-specs` command that scans project structure to generate a lightweight domain index, enabling AI agents to discover and retrieve spec content from Hive Mind on demand.

**Architecture:** New CLI command (`sync-specs`) + core module (`hive-index.ts`) that scans `src/` subdirectories and spec frontmatter, merges domains, and writes `.hivemind/specs.json`. Includes debounce logic to prevent redundant scans.

**Tech Stack:** TypeScript, vitest, js-yaml (existing), fs/path (Node.js built-in)

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `src/core/hive-index.ts` | Create | Domain scanning, index generation, debounce, index file I/O |
| `src/commands/sync-specs.ts` | Create | CLI command definition (yargs) |
| `src/index.ts` | Modify | Register `syncSpecsCommand` |
| `tests/core/hive-index.test.ts` | Create | Unit tests for domain scanning, debounce, index I/O |
| `tests/commands/sync-specs.test.ts` | Create | Integration tests for CLI command |
| `README.md` | Modify | Document `sdd sync-specs` command |

---

### Task 1: Core Module — `src/core/hive-index.ts`

**Files:**
- Create: `src/core/hive-index.ts`
- Test: `tests/core/hive-index.test.ts`

- [ ] **Step 1: Write failing tests for `scanSrcDomains`**

```typescript
// tests/core/hive-index.test.ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { scanSrcDomains, scanSpecDomains, buildIndex, writeIndex, readIndex, shouldDebounce } from "../../src/core/hive-index.js";
import { mkdirSync, rmSync, writeFileSync, existsSync, readFileSync } from "fs";
import { join } from "path";

const testDir = join(process.cwd(), "tests/fixtures/hive-index");

beforeEach(() => {
  rmSync(testDir, { recursive: true, force: true });
});

afterEach(() => {
  rmSync(testDir, { recursive: true, force: true });
});

describe("scanSrcDomains", () => {
  it("extracts first-level subdirectory names as domains", () => {
    mkdirSync(join(testDir, "src/core"), { recursive: true });
    mkdirSync(join(testDir, "src/commands"), { recursive: true });
    mkdirSync(join(testDir, "src/plugins"), { recursive: true });
    writeFileSync(join(testDir, "src/core/spec.ts"), "export {}");
    writeFileSync(join(testDir, "src/commands/init.ts"), "export {}");

    const domains = scanSrcDomains(join(testDir, "src"));
    expect(domains).toContain("core");
    expect(domains).toContain("commands");
    expect(domains).toContain("plugins");
    expect(domains).not.toContain("spec.ts");
  });

  it("returns empty array when src/ does not exist", () => {
    const domains = scanSrcDomains(join(testDir, "nonexistent/src"));
    expect(domains).toEqual([]);
  });

  it("ignores files at the src/ root level", () => {
    mkdirSync(join(testDir, "src"), { recursive: true });
    writeFileSync(join(testDir, "src/index.ts"), "export {}");

    const domains = scanSrcDomains(join(testDir, "src"));
    expect(domains).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/core/hive-index.test.ts -t "scanSrcDomains"`
Expected: FAIL with "module not found" for `../../src/core/hive-index.js`

- [ ] **Step 3: Implement `scanSrcDomains`**

```typescript
// src/core/hive-index.ts
import { readdirSync, existsSync, readFileSync, mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import yaml from "js-yaml";

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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/core/hive-index.test.ts -t "scanSrcDomains"`
Expected: PASS (3 tests)

- [ ] **Step 5: Write failing tests for `scanSpecDomains`**

Add to `tests/core/hive-index.test.ts`:

```typescript
describe("scanSpecDomains", () => {
  it("extracts unique domain values from spec frontmatter", () => {
    const specsDir = join(testDir, "specs/active");
    mkdirSync(specsDir, { recursive: true });

    writeFileSync(join(specsDir, "2026-05-01-auth.md"), `---
status: draft
author: alice
created: 2026-05-01
domain: auth
tags: []
links: { parent: null, related: [] }
pinned_commit: null
linked_files: []
---
# Auth Spec
`);

    writeFileSync(join(specsDir, "2026-05-02-billing.md"), `---
status: approved
author: bob
created: 2026-05-02
domain: billing
tags: []
links: { parent: null, related: [] }
pinned_commit: null
linked_files: []
---
# Billing Spec
`);

    writeFileSync(join(specsDir, "2026-05-03-no-domain.md"), `---
status: draft
author: alice
created: 2026-05-03
domain: null
tags: []
links: { parent: null, related: [] }
pinned_commit: null
linked_files: []
---
# No Domain Spec
`);

    const domains = scanSpecDomains(join(testDir, "specs/active"));
    expect(domains).toContain("auth");
    expect(domains).toContain("billing");
    expect(domains).not.toContain("no-domain");
  });

  it("returns empty array when specs directory does not exist", () => {
    const domains = scanSpecDomains(join(testDir, "nonexistent/specs"));
    expect(domains).toEqual([]);
  });
});
```

- [ ] **Step 6: Run tests to verify they fail**

Run: `npx vitest run tests/core/hive-index.test.ts -t "scanSpecDomains"`
Expected: FAIL (function not defined)

- [ ] **Step 7: Implement `scanSpecDomains`**

Add to `src/core/hive-index.ts`:

```typescript
const YAML_RE = /^---\n([\s\S]*?)\n---/;

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
      // Recurse into subdirectories (domain mode)
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
```

- [ ] **Step 8: Run tests to verify they pass**

Run: `npx vitest run tests/core/hive-index.test.ts -t "scanSpecDomains"`
Expected: PASS (2 tests)

- [ ] **Step 9: Write failing tests for `buildIndex`, `shouldDebounce`, `writeIndex`, `readIndex`**

Add to `tests/core/hive-index.test.ts`:

```typescript
describe("shouldDebounce", () => {
  it("returns true when last synced within 5 minutes", () => {
    const fiveMinAgo = new Date(Date.now() - 4 * 60 * 1000).toISOString();
    expect(shouldDebounce(fiveMinAgo)).toBe(true);
  });

  it("returns false when last synced more than 5 minutes ago", () => {
    const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    expect(shouldDebounce(tenMinAgo)).toBe(false);
  });

  it("returns false when lastSynced is empty", () => {
    expect(shouldDebounce("")).toBe(false);
  });
});

describe("buildIndex", () => {
  it("merges src domains and spec domains into a unified index", () => {
    // Setup src/
    mkdirSync(join(testDir, "src/core"), { recursive: true });
    mkdirSync(join(testDir, "src/commands"), { recursive: true });
    writeFileSync(join(testDir, "src/core/spec.ts"), "export {}");

    // Setup specs/
    const specsDir = join(testDir, "specs/active");
    mkdirSync(specsDir, { recursive: true });
    writeFileSync(join(specsDir, "2026-05-01-auth.md"), `---
status: draft
author: alice
created: 2026-05-01
domain: auth
tags: []
links: { parent: null, related: [] }
pinned_commit: null
linked_files: []
---
# Auth
`);

    const index = buildIndex(testDir, { srcDir: "src", specsDir: "specs/active" });
    expect(index.version).toBe("1");
    expect(index.project).toBe("hive-index");
    expect(index.domains.length).toBeGreaterThan(0);

    const domainNames = index.domains.map((d) => d.name);
    expect(domainNames).toContain("core");
    expect(domainNames).toContain("commands");
    expect(domainNames).toContain("auth");
  });
});

describe("writeIndex and readIndex", () => {
  it("writes and reads back the index file", () => {
    const indexPath = join(testDir, ".hivemind/specs.json");
    const index = buildIndex(testDir, { srcDir: "src", specsDir: "specs/active" });

    writeIndex(indexPath, index);
    expect(existsSync(indexPath)).toBe(true);

    const readBack = readIndex(indexPath);
    expect(readBack.version).toBe(index.version);
    expect(readBack.project).toBe(index.project);
    expect(readBack.domains).toEqual(index.domains);
  });

  it("returns null when index file does not exist", () => {
    const result = readIndex(join(testDir, ".hivemind/nonexistent.json"));
    expect(result).toBeNull();
  });
});
```

- [ ] **Step 10: Run tests to verify they fail**

Run: `npx vitest run tests/core/hive-index.test.ts -t "shouldDebounce|buildIndex|writeIndex|readIndex"`
Expected: FAIL (functions not defined)

- [ ] **Step 11: Implement remaining functions**

Add to `src/core/hive-index.ts`:

```typescript
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

const DEBOUNCE_MS = 5 * 60 * 1000;

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
export function buildIndex(projectRoot: string, opts: ScanOptions = {}): HiveIndex {
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
      sourceFiles.push(...collectTsFiles(srcPath, opts.srcDir ?? "src"));
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

function collectTsFiles(dir: string, basePath: string): string[] {
  const files: string[] = [];
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectTsFiles(fullPath, basePath));
    } else if (entry.name.endsWith(".ts")) {
      files.push(join(basePath, relative(join(process.cwd(), ".."), dir), entry.name));
    }
  }
  return files;
}

function relative(from: string, to: string): string {
  // Simple path relative without importing 'path.relative' to keep it explicit
  const fromParts = from.split("/").filter(Boolean);
  const toParts = to.split("/").filter(Boolean);
  let i = 0;
  while (i < fromParts.length && i < toParts.length && fromParts[i] === toParts[i]) i++;
  return toParts.slice(i).join("/");
}

function basename(p: string): string {
  return p.split("/").pop() ?? p;
}
```

- [ ] **Step 12: Run tests to verify they pass**

Run: `npx vitest run tests/core/hive-index.test.ts`
Expected: PASS (all tests)

- [ ] **Step 13: Commit**

```bash
git add src/core/hive-index.ts tests/core/hive-index.test.ts
git commit -m "feat: add hive-index core module for domain scanning and index management"
```

---

### Task 2: CLI Command — `src/commands/sync-specs.ts`

**Files:**
- Create: `src/commands/sync-specs.ts`
- Test: `tests/commands/sync-specs.test.ts`

- [ ] **Step 1: Write failing tests for the CLI command**

```typescript
// tests/commands/sync-specs.test.ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { rmSync, mkdirSync, existsSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { execSync } from "child_process";

const testDir = join(process.cwd(), "tests/fixtures/sync-specs-test");
const sddBin = join(process.cwd(), "src/index.ts");

function run(args: string, cwd: string) {
  return execSync(`npx tsx ${sddBin} ${args}`, {
    cwd,
    encoding: "utf-8",
    env: { ...process.env, FORCE_COLOR: "0" },
  });
}

beforeEach(() => {
  rmSync(testDir, { recursive: true, force: true });
  mkdirSync(testDir, { recursive: true });
  execSync(`npx tsx ${sddBin} init`, { cwd: testDir, encoding: "utf-8" });
});

afterEach(() => {
  rmSync(testDir, { recursive: true, force: true });
});

describe("sdd sync-specs", () => {
  it("creates .hivemind/specs.json after scanning", () => {
    // Create src/ structure
    mkdirSync(join(testDir, "src/core"), { recursive: true });
    writeFileSync(join(testDir, "src/core/spec.ts"), "export {}");

    const output = run("sync-specs", testDir);
    expect(output).toContain("domains");

    const indexPath = join(testDir, ".hivemind/specs.json");
    expect(existsSync(indexPath)).toBe(true);

    const index = JSON.parse(readFileSync(indexPath, "utf-8"));
    expect(index.version).toBe("1");
    expect(index.domains.length).toBeGreaterThan(0);
  });

  it("skips scan when within debounce window", () => {
    mkdirSync(join(testDir, "src/core"), { recursive: true });
    writeFileSync(join(testDir, "src/core/spec.ts"), "export {}");

    // First run
    run("sync-specs", testDir);

    // Second run immediately after should debounce
    const output = run("sync-specs", testDir);
    expect(output).toContain("up-to-date");
    expect(output).toContain("--force");
  });

  it("forces rescan with --force flag", () => {
    mkdirSync(join(testDir, "src/core"), { recursive: true });
    writeFileSync(join(testDir, "src/core/spec.ts"), "export {}");

    run("sync-specs", testDir);
    const output = run("sync-specs --force", testDir);
    expect(output).not.toContain("up-to-date");
    expect(output).toContain("domains");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/commands/sync-specs.test.ts`
Expected: FAIL (command not found)

- [ ] **Step 3: Implement the CLI command**

```typescript
// src/commands/sync-specs.ts
import type { CommandModule } from "yargs";
import { join } from "path";
import chalk from "chalk";
import { buildIndex, writeIndex, readIndex, shouldDebounce } from "../core/hive-index.js";

interface SyncSpecsArgs {
  force?: boolean;
}

export const syncSpecsCommand: CommandModule<{}, SyncSpecsArgs> = {
  command: "sync-specs",
  describe: "Scan project structure and generate Hive Mind spec index",
  builder: (yargs) =>
    yargs.option("force", {
      type: "boolean",
      describe: "Force rescan even if index is recent",
    }),
  handler: (argv) => {
    const cwd = process.cwd();
    const indexPath = join(cwd, ".hivemind", "specs.json");

    // Check debounce
    if (!argv.force) {
      const existing = readIndex(indexPath);
      if (existing && shouldDebounce(existing.last_synced)) {
        const mins = Math.floor((Date.now() - new Date(existing.last_synced).getTime()) / 60000);
        console.log(chalk.yellow(`Index up-to-date (synced ${mins} min ago). Use --force to rescan.`));
        return;
      }
    }

    const index = buildIndex(cwd);
    writeIndex(indexPath, index);

    console.log(chalk.green(`Found ${index.domains.length} domains, index written to .hivemind/specs.json`));
    if (index.domains.length > 0) {
      for (const d of index.domains) {
        console.log(chalk.dim(`  - ${d.name} (${d.source_files.length} files)`));
      }
    }
  },
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/commands/sync-specs.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/commands/sync-specs.ts tests/commands/sync-specs.test.ts
git commit -m "feat: add sync-specs CLI command with debounce logic"
```

---

### Task 3: Register Command in `src/index.ts`

**Files:**
- Modify: `src/index.ts`

- [ ] **Step 1: Add import and register command**

Modify `src/index.ts`:

```typescript
#!/usr/bin/env node
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { initCommand } from "./commands/init.js";
import { newCommand } from "./commands/new.js";
import { statusCommand } from "./commands/status.js";
import { amendCommand } from "./commands/amend.js";
import { syncSpecsCommand } from "./commands/sync-specs.js";
import { loadPlugins } from "./plugins/loader.js";
import { readConfig } from "./core/config.js";

async function main() {
  const cwd = process.cwd();
  let config;
  try { config = readConfig(cwd); } catch { config = undefined; }

  const y = yargs(hideBin(process.argv))
    .scriptName("sdd")
    .usage("$0 <command> [options]")
    .command(initCommand)
    .command(newCommand)
    .command(statusCommand)
    .command(amendCommand)
    .command(syncSpecsCommand)
    .demandCommand(1, "Use one of the commands above")
    .help()
    .version("0.1.0");

  if (config) {
    const pluginCommands = await loadPlugins(config, cwd);
    for (const cmd of pluginCommands) y.command(cmd);
  }

  y.parse();
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
```

- [ ] **Step 2: Verify command is available**

Run: `npx tsx src/index.ts sync-specs --help`
Expected: Shows help text for sync-specs command

- [ ] **Step 3: Run full test suite**

Run: `npm test`
Expected: All tests pass

- [ ] **Step 4: Commit**

```bash
git add src/index.ts
git commit -m "feat: register sync-specs command in CLI entry point"
```

---

### Task 4: Update README Documentation

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Add sync-specs to the commands table**

In `README.md`, add to the "Core (always available)" table:

```markdown
| Command | Description |
|---------|-------------|
| `sdd init` | Scaffold SDD directory structure in current project |
| `sdd new <name>` | Create from template (`--type`: `feature-spec` (default), `feature-spec-pm`, `qa-from-spec`, `design-doc`, `adr`) |
| `sdd status` | List all specs with status and staleness indicators |
| `sdd amend <spec>` | Record a minor change to an existing spec |
| `sdd sync-specs` | Scan project and generate Hive Mind spec index (`.hivemind/specs.json`) |
```

- [ ] **Step 2: Add a new section explaining Hive Mind integration**

Add after the "AI Integration" section:

```markdown
### Hive Mind Spec Index

`sdd sync-specs` generates a lightweight domain index at `.hivemind/specs.json` that helps AI agents discover project structure and retrieve spec content from Hive Mind on demand.

```bash
# Generate index (scans src/ and specs/active/)
sdd sync-specs

# Force rescan (ignores 5-minute debounce)
sdd sync-specs --force
```

The index contains domain names, source file mappings, and Hive Mind resource URIs. AI agents use this as a "table of contents" — they read the index to know what domains exist, then retrieve actual spec content from Hive Mind cloud when needed.

**Index format:**
```json
{
  "version": "1",
  "project": "my-project",
  "last_synced": "2026-05-13T00:00:00Z",
  "domains": [
    {
      "name": "auth",
      "description": "Domain: auth",
      "source_files": ["src/core/auth.ts"],
      "hive_uri": null
    }
  ]
}
```
```

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: add sync-specs command and Hive Mind integration section"
```

---

### Task 5: Final Verification

- [ ] **Step 1: Run full test suite**

Run: `npm test`
Expected: All tests pass, including new hive-index and sync-specs tests

- [ ] **Step 2: Manual end-to-end test**

```bash
cd /tmp && mkdir test-sdd && cd test-sdd
npx tsx /Users/kyle/Code/s2s_open_spec/src/index.ts init
mkdir -p src/api src/core
echo "export {}" > src/api/routes.ts
echo "export {}" > src/core/spec.ts
npx tsx /Users/kyle/Code/s2s_open_spec/src/index.ts sync-specs
cat .hivemind/specs.json
```

Expected: Index file contains `api` and `core` domains with correct source file paths.

- [ ] **Step 3: Verify debounce**

```bash
npx tsx /Users/kyle/Code/s2s_open_spec/src/index.ts sync-specs
```

Expected: "Index up-to-date (synced 0 min ago). Use --force to rescan."

- [ ] **Step 4: Verify --force**

```bash
npx tsx /Users/kyle/Code/s2s_open_spec/src/index.ts sync-specs --force
```

Expected: "Found N domains, index written to .hivemind/specs.json"

- [ ] **Step 5: Clean up test directory**

```bash
rm -rf /tmp/test-sdd
```

- [ ] **Step 6: Final commit if any changes**

```bash
git status
```
