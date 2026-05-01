# SDD Framework Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a TypeScript CLI (`sdd`) that scaffolds spec-driven-development projects, manages spec lifecycle via 4 core commands (init, new, status, amend), and supports opt-in plugins for workflow, doctor, and diff.

**Architecture:** Node.js CLI using yargs for arg parsing. Core commands operate on markdown spec files with YAML frontmatter. Plugins are standalone modules loaded dynamically via config. All state lives in git + markdown files — no database.

**Tech Stack:** TypeScript 5.x, Node.js 20+, yargs, js-yaml, chalk, vitest, tsx

---

## File Map

```
sdd-framework/
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── bin/
│   └── sdd.js                  # Package entry (npm bin)
├── scaffold/                   # Static files copied by sdd init
│   ├── specs/
│   │   ├── active/.gitkeep
│   │   ├── completed/.gitkeep
│   │   └── archived/.gitkeep
│   ├── design/.gitkeep
│   ├── templates/
│   │   ├── feature-spec.md
│   │   ├── feature-spec-minimal.md
│   │   ├── feature-spec-full.md
│   │   ├── design-doc.md
│   │   └── adr.md
│   ├── .sdd/config.yaml
│   └── CLAUDE.md
├── src/
│   ├── index.ts                # CLI entry: yargs wiring + plugin loader
│   ├── commands/
│   │   ├── init.ts             # sdd init
│   │   ├── new.ts              # sdd new
│   │   ├── status.ts           # sdd status
│   │   └── amend.ts            # sdd amend
│   ├── core/
│   │   ├── config.ts           # readConfig, writeConfig, Config type
│   │   ├── spec.ts             # parseSpec, updateFrontmatter, Spec type
│   │   ├── scaffold.ts         # copyScaffold, renderTemplate
│   │   └── git.ts              # gitInit, getCurrentUser, getDiff, getHeadCommit
│   └── plugins/
│       ├── loader.ts           # loadPlugins, Plugin interface
│       ├── workflow.ts         # review, plan, complete, archive
│       ├── doctor.ts           # doctor command
│       └── diff.ts             # diff command
├── extractors/
│   ├── typescript.ts           # parseTsInterfaces
│   └── python.ts               # parsePyInterfaces
└── tests/
    ├── core/
    │   ├── config.test.ts
    │   ├── spec.test.ts
    │   └── scaffold.test.ts
    ├── commands/
    │   ├── init.test.ts
    │   ├── new.test.ts
    │   ├── status.test.ts
    │   └── amend.test.ts
    └── plugins/
        ├── doctor.test.ts
        └── diff.test.ts
```

**Responsibility boundaries:**
- `core/config.ts` — reads/writes `.sdd/config.yaml`. Source of truth for all settings.
- `core/spec.ts` — parses YAML frontmatter + markdown body. Knows the status lifecycle but doesn't enforce it.
- `core/scaffold.ts` — file copy + template variable substitution. Doesn't know about CLI args.
- `core/git.ts` — thin wrappers around `git` child_process calls. All git interaction goes through here.
- `commands/*.ts` — each exports a yargs command module. Calls core modules.
- `plugins/*.ts` — same shape as commands. Loaded dynamically by `loader.ts`.
- `extractors/*.ts` — stateless: input = file content string, output = list of interface shapes.

---

## Phase 1: Foundation

### Task 1: Project setup

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vitest.config.ts`
- Create: `src/index.ts` (stub)
- Create: `bin/sdd.js` (stub)

- [ ] **Step 1: Create package.json**

```json
{
  "name": "sdd-cli",
  "version": "0.1.0",
  "description": "Spec-Driven Development CLI",
  "type": "module",
  "bin": {
    "sdd": "./bin/sdd.js"
  },
  "scripts": {
    "dev": "tsx src/index.ts",
    "build": "tsc",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "chalk": "^5.3.0",
    "js-yaml": "^4.1.0",
    "yargs": "^17.7.2"
  },
  "devDependencies": {
    "@types/js-yaml": "^4.0.9",
    "@types/node": "^20.14.0",
    "@types/yargs": "^17.0.32",
    "tsx": "^4.19.0",
    "typescript": "^5.5.0",
    "vitest": "^1.6.0"
  }
}
```

- [ ] **Step 2: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "bundler",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

- [ ] **Step 3: Create vitest.config.ts**

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
  },
});
```

- [ ] **Step 4: Create bin entry point**

```javascript
#!/usr/bin/env node
import "../dist/index.js";
```

- [ ] **Step 5: Create src/index.ts stub**

```typescript
#!/usr/bin/env node
console.log("SDD CLI");
```

- [ ] **Step 6: Install dependencies and verify**

```bash
npm install
```

- [ ] **Step 7: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json tsconfig.json vitest.config.ts bin/ src/
git commit -m "chore: initialize TypeScript project with vitest"
```

---

### Task 2: Config module

**Files:**
- Create: `src/core/config.ts`
- Create: `tests/core/config.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/core/config.test.ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { readConfig, writeConfig, defaultConfig } from "../../src/core/config.js";
import { mkdirSync, writeFileSync, rmSync } from "fs";
import { join } from "path";

const testDir = join(process.cwd(), "tests/fixtures/config-test");

function writeTestConfig(path: string, content: string) {
  mkdirSync(path, { recursive: true });
  writeFileSync(join(path, ".sdd", "config.yaml"), content);
}

beforeEach(() => {
  rmSync(testDir, { recursive: true, force: true });
});

afterEach(() => {
  rmSync(testDir, { recursive: true, force: true });
});

describe("readConfig", () => {
  it("returns defaults when no config file exists", () => {
    mkdirSync(testDir, { recursive: true });
    const config = readConfig(testDir);
    expect(config).toEqual(defaultConfig);
  });

  it("reads and merges with defaults", () => {
    writeTestConfig(testDir, "mode: domain\ntemplate: minimal\n");
    const config = readConfig(testDir);
    expect(config.mode).toBe("domain");
    expect(config.template).toBe("minimal");
    expect(config.version).toBe("1");
  });

  it("reads plugin settings", () => {
    writeTestConfig(testDir, "plugins:\n  doctor: true\n  diff: true\n");
    const config = readConfig(testDir);
    expect(config.plugins.doctor).toBe(true);
    expect(config.plugins.diff).toBe(true);
    expect(config.plugins.workflow).toBe(false);
  });
});

describe("writeConfig", () => {
  it("writes config to .sdd/config.yaml", () => {
    mkdirSync(testDir, { recursive: true });
    const cfg = { ...defaultConfig, mode: "domain" as const };
    writeConfig(testDir, cfg);
    const reread = readConfig(testDir);
    expect(reread.mode).toBe("domain");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/core/config.test.ts
```
Expected: FAIL (module not found).

- [ ] **Step 3: Implement config module**

```typescript
// src/core/config.ts
import { readFileSync, mkdirSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import yaml from "js-yaml";

export type Mode = "flat" | "domain" | "team";
export type Template = "minimal" | "default" | "full";

export interface PluginSettings {
  doctor: boolean;
  diff: boolean;
  workflow: boolean;
  board: boolean;
  git_hooks: boolean;
  ai: boolean;
}

export interface Config {
  version: string;
  mode: Mode;
  template: Template;
  doctor: { flat_max: number; similarity_threshold: number };
  paths: { specs: string; active: string; completed: string; archived: string };
  plugins: PluginSettings;
  extractors: Record<string, string | null>;
}

export const defaultConfig: Config = {
  version: "1",
  mode: "flat",
  template: "default",
  doctor: { flat_max: 12, similarity_threshold: 0.6 },
  paths: { specs: "specs/", active: "specs/active/", completed: "specs/completed/", archived: "specs/archived/" },
  plugins: { doctor: false, diff: false, workflow: false, board: false, git_hooks: false, ai: false },
  extractors: { ".ts": "typescript", ".py": "python", ".go": null },
};

export function readConfig(projectRoot: string): Config {
  const configPath = join(projectRoot, ".sdd", "config.yaml");
  if (!existsSync(configPath)) return { ...defaultConfig };
  const raw = readFileSync(configPath, "utf-8");
  const parsed = yaml.load(raw) as Partial<Config>;
  if (!parsed) return { ...defaultConfig };
  return deepMerge(defaultConfig, parsed);
}

export function writeConfig(projectRoot: string, config: Config): void {
  mkdirSync(join(projectRoot, ".sdd"), { recursive: true });
  writeFileSync(join(projectRoot, ".sdd", "config.yaml"), yaml.dump(config, { indent: 2, lineWidth: 120 }));
}

function deepMerge<T extends Record<string, unknown>>(defaults: T, overrides: Partial<T>): T {
  const result = { ...defaults } as Record<string, unknown>;
  for (const key of Object.keys(overrides)) {
    const ov = overrides[key];
    const dv = defaults[key as keyof T];
    if (ov !== null && typeof ov === "object" && !Array.isArray(ov) && typeof dv === "object" && !Array.isArray(dv)) {
      result[key] = deepMerge(dv as Record<string, unknown>, ov as Record<string, unknown>);
    } else if (ov !== undefined) {
      result[key] = ov;
    }
  }
  return result as T;
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run tests/core/config.test.ts
```
Expected: all 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/config.ts tests/core/config.test.ts
git commit -m "feat: add config module with YAML read/write"
```

---

### Task 3: Spec parser

**Files:**
- Create: `src/core/spec.ts`
- Create: `tests/core/spec.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/core/spec.test.ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { parseSpec, updateFrontmatter, appendChangelog } from "../../src/core/spec.js";
import { writeFileSync, mkdirSync, rmSync } from "fs";
import { join } from "path";

const testDir = join(process.cwd(), "tests/fixtures/spec-test");

function makeSpec(content: string) {
  const dir = join(testDir, "specs/active");
  mkdirSync(dir, { recursive: true });
  const path = join(dir, "2026-05-01-test.md");
  writeFileSync(path, content);
  return path;
}

beforeEach(() => {
  rmSync(testDir, { recursive: true, force: true });
});

afterEach(() => {
  rmSync(testDir, { recursive: true, force: true });
});

describe("parseSpec", () => {
  it("parses YAML frontmatter and body", () => {
    const path = makeSpec(`---
status: draft
author: wade
created: 2026-05-01
domain: auth
tags: [api, login]
links:
  parent: null
  related: []
pinned_commit: null
linked_files: []
---

# Test Spec

## Problem
Something needs fixing.
`);

    const spec = parseSpec(path);
    expect(spec.frontmatter.status).toBe("draft");
    expect(spec.frontmatter.author).toBe("wade");
    expect(spec.frontmatter.domain).toBe("auth");
    expect(spec.frontmatter.tags).toEqual(["api", "login"]);
    expect(spec.body).toContain("Something needs fixing");
  });

  it("uses defaults for missing frontmatter fields", () => {
    const path = makeSpec(`---
status: draft
---

# Minimal
`);
    const spec = parseSpec(path);
    expect(spec.frontmatter.author).toBe("");
    expect(spec.frontmatter.domain).toBeNull();
    expect(spec.frontmatter.tags).toEqual([]);
  });
});

describe("updateFrontmatter", () => {
  it("updates a frontmatter field and writes back", () => {
    const path = makeSpec(`---
status: draft
author: wade
created: 2026-05-01
domain: null
tags: []
links:
  parent: null
  related: []
pinned_commit: null
linked_files: []
---

# Test
`);
    updateFrontmatter(path, { status: "approved", pinned_commit: "def456" });
    const reread = parseSpec(path);
    expect(reread.frontmatter.status).toBe("approved");
    expect(reread.frontmatter.pinned_commit).toBe("def456");
    expect(reread.frontmatter.author).toBe("wade");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/core/spec.test.ts
```
Expected: FAIL.

- [ ] **Step 3: Implement spec parser**

```typescript
// src/core/spec.ts
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
  // Find last changelog table row
  for (let i = lines.length - 1; i >= 0; i--) {
    if (lines[i].startsWith("| ") && lines[i].includes(" | ")) {
      lines.splice(i + 1, 0, row);
      writeFileSync(filePath, lines.join("\n"));
      return;
    }
  }
  // No table found — append one
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
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run tests/core/spec.test.ts
```
Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/spec.ts tests/core/spec.test.ts
git commit -m "feat: add spec parser with YAML frontmatter support"
```

---

### Task 4: Git wrapper

**Files:**
- Create: `src/core/git.ts`

- [ ] **Step 1: Implement git wrapper (no test — thin wrappers, tested through integration)**

```typescript
// src/core/git.ts
import { execSync } from "child_process";

export function gitInit(cwd: string): void {
  execSync("git init", { cwd, stdio: "pipe" });
}

export function isGitRepo(cwd: string): boolean {
  try {
    execSync("git rev-parse --git-dir", { cwd, stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}

export function getCurrentUser(cwd: string): string {
  try {
    return execSync("git config user.name", { cwd, encoding: "utf-8" }).trim();
  } catch {
    return "";
  }
}

export function getHeadCommit(cwd: string): string {
  try {
    return execSync("git rev-parse HEAD", { cwd, encoding: "utf-8" }).trim();
  } catch {
    return "";
  }
}

export function getDiffStat(fromCommit: string, files: string[], cwd: string): string {
  try {
    const fileArgs = files.length > 0 ? `-- ${files.join(" ")}` : "";
    return execSync(`git diff --stat ${fromCommit}..HEAD ${fileArgs}`, { cwd, encoding: "utf-8" }).trim();
  } catch {
    return "";
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/core/git.ts
git commit -m "feat: add git wrapper for repo detection and diff"
```

---

## Phase 2: Scaffold

### Task 5: Scaffold data and module

**Files:**
- Create: `scaffold/specs/active/.gitkeep`
- Create: `scaffold/specs/completed/.gitkeep`
- Create: `scaffold/specs/archived/.gitkeep`
- Create: `scaffold/design/.gitkeep`
- Create: `scaffold/templates/feature-spec.md`
- Create: `scaffold/templates/feature-spec-minimal.md`
- Create: `scaffold/templates/feature-spec-full.md`
- Create: `scaffold/templates/design-doc.md`
- Create: `scaffold/templates/adr.md`
- Create: `scaffold/.sdd/config.yaml`
- Create: `scaffold/CLAUDE.md`
- Create: `src/core/scaffold.ts`
- Create: `tests/core/scaffold.test.ts`

- [ ] **Step 1: Create directories**

```bash
mkdir -p scaffold/specs/active scaffold/specs/completed scaffold/specs/archived scaffold/design scaffold/templates scaffold/.sdd
touch scaffold/specs/active/.gitkeep scaffold/specs/completed/.gitkeep scaffold/specs/archived/.gitkeep scaffold/design/.gitkeep
```

- [ ] **Step 2: Create templates**

Write `scaffold/templates/feature-spec.md` — the default template (Problem, Constraints, Design > Interfaces/Components/Trade-offs, Edge Cases, Review Log, Changelog).

Write `scaffold/templates/feature-spec-minimal.md` — Problem + Interfaces + Review Log + Changelog only.

Write `scaffold/templates/feature-spec-full.md` — everything in default plus Architecture, Risks, Alternatives Considered, Rollout Plan.

Write `scaffold/templates/design-doc.md` — Context, Decision, Rationale, Consequences, Review Log.

Write `scaffold/templates/adr.md` — Status, Context, Decision, Consequences.

All templates use `{{AUTHOR}}`, `{{DATE}}`, `{{TITLE}}`, `{{DOMAIN}}`, `{{NUMBER}}` placeholders.

- [ ] **Step 3: Create scaffold config and CLAUDE.md**

Write `scaffold/.sdd/config.yaml` with defaults (flat mode, all plugins off).

Write `scaffold/CLAUDE.md` with SDD workflow rules:
- Check specs before coding
- Status lifecycle: draft → ready → approved → in-progress → complete
- When to update a spec (bug fix: no, refactor: no, API change: yes)
- When to create a new spec

- [ ] **Step 4: Write failing test for scaffold**

```typescript
// tests/core/scaffold.test.ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { copyScaffold, renderTemplate } from "../../src/core/scaffold.js";
import { existsSync, rmSync, mkdirSync } from "fs";
import { join } from "path";

const testDir = join(process.cwd(), "tests/fixtures/scaffold-test");

beforeEach(() => {
  rmSync(testDir, { recursive: true, force: true });
  mkdirSync(testDir, { recursive: true });
});

afterEach(() => {
  rmSync(testDir, { recursive: true, force: true });
});

describe("renderTemplate", () => {
  it("replaces template variables", () => {
    expect(renderTemplate("Hello {{NAME}}", { NAME: "world" })).toBe("Hello world");
  });
});

describe("copyScaffold", () => {
  it("copies scaffold to target directory", () => {
    copyScaffold(testDir, { author: "test-user", date: "2026-05-01" });
    expect(existsSync(join(testDir, "specs/active/.gitkeep"))).toBe(true);
    expect(existsSync(join(testDir, ".sdd/config.yaml"))).toBe(true);
    expect(existsSync(join(testDir, "CLAUDE.md"))).toBe(true);
  });
});
```

- [ ] **Step 5: Run test to verify it fails**

```bash
npx vitest run tests/core/scaffold.test.ts
```
Expected: FAIL.

- [ ] **Step 6: Implement scaffold module**

```typescript
// src/core/scaffold.ts
import { mkdirSync, readFileSync, writeFileSync, readdirSync, statSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const scaffoldDir = join(__dirname, "..", "..", "scaffold");

export interface ScaffoldVars {
  author: string;
  date: string;
}

export function renderTemplate(template: string, vars: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replaceAll(`{{${key}}}`, value);
  }
  return result;
}

export function copyScaffold(targetDir: string, vars: ScaffoldVars): void {
  copyDir(scaffoldDir, targetDir, vars);
}

function copyDir(src: string, dest: string, vars: ScaffoldVars): void {
  mkdirSync(dest, { recursive: true });
  for (const entry of readdirSync(src)) {
    const srcPath = join(src, entry);
    const destPath = join(dest, entry);
    if (statSync(srcPath).isDirectory()) {
      copyDir(srcPath, destPath, vars);
    } else {
      const content = renderTemplate(readFileSync(srcPath, "utf-8"), { ...vars });
      mkdirSync(dirname(destPath), { recursive: true });
      writeFileSync(destPath, content);
    }
  }
}
```

- [ ] **Step 7: Run test to verify it passes**

```bash
npx vitest run tests/core/scaffold.test.ts
```
Expected: all tests PASS.

- [ ] **Step 8: Commit**

```bash
git add scaffold/ src/core/scaffold.ts tests/core/scaffold.test.ts
git commit -m "feat: add scaffold with templates and copy logic"
```

---

## Phase 3: Core Commands

### Task 6: sdd init command

**Files:**
- Create: `src/commands/init.ts`
- Create: `tests/commands/init.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// tests/commands/init.test.ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { existsSync, rmSync, mkdirSync } from "fs";
import { join } from "path";
import { execSync } from "child_process";

const testDir = join(process.cwd(), "tests/fixtures/init-test");
const sddBin = join(process.cwd(), "src/index.ts");

function run(args: string, cwd: string) {
  return execSync(`npx tsx ${sddBin} ${args}`, { cwd, encoding: "utf-8", env: { ...process.env, FORCE_COLOR: "0" } });
}

beforeEach(() => {
  rmSync(testDir, { recursive: true, force: true });
  mkdirSync(testDir, { recursive: true });
});

afterEach(() => {
  rmSync(testDir, { recursive: true, force: true });
});

describe("sdd init", () => {
  it("scaffolds a project with all expected directories", () => {
    run("init", testDir);
    expect(existsSync(join(testDir, "specs/active/.gitkeep"))).toBe(true);
    expect(existsSync(join(testDir, ".sdd/config.yaml"))).toBe(true);
    expect(existsSync(join(testDir, "CLAUDE.md"))).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/commands/init.test.ts
```
Expected: FAIL.

- [ ] **Step 3: Implement init command**

```typescript
// src/commands/init.ts
import type { CommandModule } from "yargs";
import { existsSync, readdirSync } from "fs";
import { join } from "path";
import { copyScaffold } from "../core/scaffold.js";
import { writeConfig, readConfig, type Mode, type Template } from "../core/config.js";
import { gitInit, getCurrentUser } from "../core/git.js";
import chalk from "chalk";

interface InitArgs {
  mode?: Mode;
  template?: Template;
  force?: boolean;
}

export const initCommand: CommandModule<{}, InitArgs> = {
  command: "init",
  describe: "Scaffold an SDD project in the current directory",
  builder: (yargs) =>
    yargs
      .option("mode", { type: "string", choices: ["flat", "domain", "team"] as const })
      .option("template", { type: "string", choices: ["minimal", "default", "full"] as const })
      .option("force", { type: "boolean", describe: "Skip non-empty directory check" }),
  handler: (argv) => {
    const cwd = process.cwd();
    const existing = existsSync(cwd) ? readdirSync(cwd).filter((f) => f !== ".git") : [];
    if (existing.length > 0 && !argv.force) {
      console.error(chalk.red(`Directory not empty (${existing.length} items). Use --force to override.`));
      process.exit(1);
    }
    const author = getCurrentUser(cwd) || "unknown";
    const date = new Date().toISOString().slice(0, 10);
    copyScaffold(cwd, { author, date });
    const config = readConfig(cwd);
    if (argv.mode) config.mode = argv.mode;
    if (argv.template) config.template = argv.template;
    writeConfig(cwd, config);
    if (!existsSync(join(cwd, ".git"))) gitInit(cwd);
    console.log(chalk.green(`SDD project initialized. Mode: ${config.mode}, Template: ${config.template}`));
  },
};
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run tests/commands/init.test.ts
```
Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/commands/init.ts tests/commands/init.test.ts
git commit -m "feat: add sdd init command"
```

---

### Task 7: sdd new command

**Files:**
- Create: `src/commands/new.ts`
- Create: `tests/commands/new.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// tests/commands/new.test.ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { existsSync, readdirSync, rmSync, mkdirSync } from "fs";
import { join } from "path";
import { execSync } from "child_process";

const testDir = join(process.cwd(), "tests/fixtures/new-test");
const sddBin = join(process.cwd(), "src/index.ts");

function run(args: string, cwd: string) {
  return execSync(`npx tsx ${sddBin} ${args}`, { cwd, encoding: "utf-8", env: { ...process.env, FORCE_COLOR: "0", EDITOR: "echo" } });
}

beforeEach(() => {
  rmSync(testDir, { recursive: true, force: true });
  mkdirSync(testDir, { recursive: true });
  execSync(`npx tsx ${sddBin} init`, { cwd: testDir, encoding: "utf-8" });
});

afterEach(() => {
  rmSync(testDir, { recursive: true, force: true });
});

describe("sdd new", () => {
  it("creates a spec file in specs/active/", () => {
    run("new user-auth", testDir);
    const files = readdirSync(join(testDir, "specs/active"));
    const specFile = files.find((f) => f.endsWith("user-auth.md"));
    expect(specFile).toBeDefined();
    expect(specFile).toMatch(/^\d{4}-\d{2}-\d{2}-user-auth\.md$/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/commands/new.test.ts
```
Expected: FAIL.

- [ ] **Step 3: Implement new command**

```typescript
// src/commands/new.ts
import type { CommandModule } from "yargs";
import { readConfig } from "../core/config.js";
import { renderTemplate } from "../core/scaffold.js";
import { getCurrentUser } from "../core/git.js";
import { mkdirSync, writeFileSync, readFileSync } from "fs";
import { join } from "path";
import { execSync } from "child_process";
import chalk from "chalk";

interface NewArgs {
  name: string;
  type?: "feature-spec" | "design-doc" | "adr";
  domain?: string;
}

const TYPE_TEMPLATE: Record<string, string> = {
  "feature-spec": "templates/feature-spec.md",
  "design-doc": "templates/design-doc.md",
  adr: "templates/adr.md",
};

export const newCommand: CommandModule<{}, NewArgs> = {
  command: "new <name>",
  describe: "Create a new spec",
  builder: (yargs) =>
    yargs
      .positional("name", { type: "string", describe: "Spec name", demandOption: true })
      .option("type", { type: "string", choices: ["feature-spec", "design-doc", "adr"] as const, default: "feature-spec" })
      .option("domain", { type: "string", describe: "Domain for domain/team modes" }),
  handler: (argv) => {
    const cwd = process.cwd();
    const config = readConfig(cwd);
    const name = argv.name!.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
    const date = new Date().toISOString().slice(0, 10);
    const filename = `${date}-${name}.md`;

    let activeDir = join(cwd, config.paths.active);
    if ((config.mode === "domain" || config.mode === "team") && argv.domain) {
      activeDir = join(activeDir, argv.domain);
    }
    mkdirSync(activeDir, { recursive: true });

    const templateFile = TYPE_TEMPLATE[argv.type!] ?? TYPE_TEMPLATE["feature-spec"];
    const template = readFileSync(join(cwd, templateFile), "utf-8");
    const author = getCurrentUser(cwd) || "unknown";

    const content = renderTemplate(template, {
      AUTHOR: author,
      DATE: date,
      TITLE: argv.name!,
      DOMAIN: argv.domain ?? "null",
      NUMBER: String(Math.floor(Math.random() * 1000)).padStart(3, "0"),
    });

    const specPath = join(activeDir, filename);
    writeFileSync(specPath, content);
    console.log(chalk.green(`Created: ${specPath}`));

    const editor = process.env.EDITOR || process.env.VISUAL;
    if (editor) {
      try { execSync(`${editor} "${specPath}"`, { cwd, stdio: "inherit" }); } catch { /* best-effort */ }
    }
  },
};
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run tests/commands/new.test.ts
```
Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/commands/new.ts tests/commands/new.test.ts
git commit -m "feat: add sdd new command"
```

---

### Task 8: sdd status command

**Files:**
- Create: `src/commands/status.ts`
- Create: `tests/commands/status.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// tests/commands/status.test.ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { rmSync, mkdirSync } from "fs";
import { join } from "path";
import { execSync } from "child_process";

const testDir = join(process.cwd(), "tests/fixtures/status-test");
const sddBin = join(process.cwd(), "src/index.ts");

function run(args: string, cwd: string) {
  return execSync(`npx tsx ${sddBin} ${args}`, { cwd, encoding: "utf-8", env: { ...process.env, FORCE_COLOR: "0" } });
}

beforeEach(() => {
  rmSync(testDir, { recursive: true, force: true });
  mkdirSync(testDir, { recursive: true });
  execSync(`npx tsx ${sddBin} init`, { cwd: testDir, encoding: "utf-8" });
});

afterEach(() => {
  rmSync(testDir, { recursive: true, force: true });
});

describe("sdd status", () => {
  it("shows no specs when project is empty", () => {
    const output = run("status", testDir);
    expect(output).toContain("No active specs");
  });

  it("lists a newly created spec with draft status", () => {
    execSync(`npx tsx ${sddBin} new test-feature`, { cwd: testDir, encoding: "utf-8", env: { ...process.env, FORCE_COLOR: "0", EDITOR: "echo" } });
    const output = run("status", testDir);
    expect(output).toContain("test-feature");
    expect(output).toContain("draft");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/commands/status.test.ts
```
Expected: FAIL.

- [ ] **Step 3: Implement status command**

```typescript
// src/commands/status.ts
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
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run tests/commands/status.test.ts
```
Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/commands/status.ts tests/commands/status.test.ts
git commit -m "feat: add sdd status command with filters"
```

---

### Task 9: sdd amend command

**Files:**
- Create: `src/commands/amend.ts`
- Create: `tests/commands/amend.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// tests/commands/amend.test.ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { readdirSync, rmSync, mkdirSync } from "fs";
import { join } from "path";
import { execSync } from "child_process";

const testDir = join(process.cwd(), "tests/fixtures/amend-test");
const sddBin = join(process.cwd(), "src/index.ts");

function run(args: string, cwd: string) {
  return execSync(`npx tsx ${sddBin} ${args}`, { cwd, encoding: "utf-8", env: { ...process.env, FORCE_COLOR: "0", EDITOR: "echo" } });
}

beforeEach(() => {
  rmSync(testDir, { recursive: true, force: true });
  mkdirSync(testDir, { recursive: true });
  execSync(`npx tsx ${sddBin} init`, { cwd: testDir, encoding: "utf-8" });
  execSync(`npx tsx ${sddBin} new amend-test`, { cwd: testDir, encoding: "utf-8", env: { ...process.env, FORCE_COLOR: "0", EDITOR: "echo" } });
});

afterEach(() => {
  rmSync(testDir, { recursive: true, force: true });
});

describe("sdd amend", () => {
  it("appends a changelog entry to the spec", () => {
    const files = readdirSync(join(testDir, "specs/active"));
    const specFile = files.find((f) => f.endsWith("amend-test.md"))!;
    const specPath = join("specs/active", specFile);

    // Use -m flag to avoid editor prompt
    run(`amend "${specPath}" -m "Added remember_me param"`, testDir);

    const { parseSpec } = require("../../src/core/spec.js");
    const spec = parseSpec(join(testDir, specPath));
    expect(spec.changelog.length).toBeGreaterThan(0);
    expect(spec.changelog[0].change).toContain("remember_me");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/commands/amend.test.ts
```
Expected: FAIL.

- [ ] **Step 3: Implement amend command**

```typescript
// src/commands/amend.ts
import type { CommandModule } from "yargs";
import { parseSpec, appendChangelog, updateFrontmatter } from "../core/spec.js";
import { getDiffStat, getHeadCommit, getCurrentUser } from "../core/git.js";
import { writeFileSync, readFileSync, rmSync } from "fs";
import { join } from "path";
import { execSync } from "child_process";
import chalk from "chalk";

interface AmendArgs {
  spec: string;
  message?: string;
}

export const amendCommand: CommandModule<{}, AmendArgs> = {
  command: "amend <spec>",
  describe: "Record a minor change to a spec",
  builder: (yargs) =>
    yargs
      .positional("spec", { type: "string", describe: "Path to spec file", demandOption: true })
      .option("message", { type: "string", alias: "m", describe: "Change description" }),
  handler: (argv) => {
    const cwd = process.cwd();
    const specPath = join(cwd, argv.spec!);
    const spec = parseSpec(specPath);
    const fm = spec.frontmatter;

    if (fm.pinned_commit) {
      const diffStat = getDiffStat(fm.pinned_commit, fm.linked_files, cwd);
      if (diffStat) {
        console.log(chalk.gray("Changes since last baseline:\n" + diffStat));
      } else {
        console.log(chalk.gray("No code changes detected since pinned commit."));
      }
    } else {
      console.log(chalk.gray("No pinned commit. Use `sdd review` to set a baseline."));
    }

    let change = argv.message;
    if (!change) {
      const editor = process.env.EDITOR || process.env.VISUAL || "vim";
      const tmpFile = join(cwd, ".sdd", ".amend-msg");
      writeFileSync(tmpFile, "# Describe the change:\n");
      try {
        execSync(`${editor} "${tmpFile}"`, { cwd, stdio: "inherit" });
        change = readFileSync(tmpFile, "utf-8").split("\n").filter((l) => !l.startsWith("#")).join("\n").trim();
      } catch { /* editor failed */ }
      try { rmSync(tmpFile); } catch { /* cleanup */ }
    }

    if (!change) {
      console.log(chalk.yellow("No change description provided. Aborting."));
      return;
    }

    const date = new Date().toISOString().slice(0, 10);
    const author = getCurrentUser(cwd) || fm.author || "unknown";
    appendChangelog(specPath, { date, change, author });

    const head = getHeadCommit(cwd);
    if (head) updateFrontmatter(specPath, { pinned_commit: head });

    console.log(chalk.green(`Changelog updated: ${change}`));
  },
};
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run tests/commands/amend.test.ts
```
Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/commands/amend.ts tests/commands/amend.test.ts
git commit -m "feat: add sdd amend command"
```

---

### Task 10: CLI entry point — wire everything

**Files:**
- Modify: `src/index.ts`

- [ ] **Step 1: Rewrite index.ts**

Replace stub with full CLI entry:

```typescript
#!/usr/bin/env node
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { initCommand } from "./commands/init.js";
import { newCommand } from "./commands/new.js";
import { statusCommand } from "./commands/status.js";
import { amendCommand } from "./commands/amend.js";
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

- [ ] **Step 2: Verify CLI works end-to-end**

```bash
npx tsx src/index.ts --help
```
Expected: shows help with init, new, status, amend commands.

```bash
rm -rf /tmp/sdd-smoke && mkdir /tmp/sdd-smoke && cd /tmp/sdd-smoke && npx tsx ~/sdd_learning/src/index.ts init && ls specs/active/
```
Expected: shows `.gitkeep` in active dir.

- [ ] **Step 3: Commit**

```bash
git add src/index.ts
git commit -m "feat: wire CLI entry point with yargs"
```

---

## Phase 4: Plugins

### Task 11: Plugin loader

**Files:**
- Create: `src/plugins/loader.ts`
- Create: `tests/plugins/loader.test.ts`

- [ ] **Step 1: Implement plugin loader**

```typescript
// src/plugins/loader.ts
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

  return commands;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/plugins/loader.ts
git commit -m "feat: add plugin loader"
```

---

### Task 12: Workflow plugin (review, plan, complete, archive)

**Files:**
- Create: `src/plugins/workflow.ts`

- [ ] **Step 1: Implement workflow plugin**

```typescript
// src/plugins/workflow.ts
import type { CommandModule } from "yargs";
import { parseSpec, updateFrontmatter, type SpecStatus } from "../core/spec.js";
import { getHeadCommit, getCurrentUser } from "../core/git.js";
import { readConfig } from "../core/config.js";
import { existsSync, renameSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import chalk from "chalk";

const reviewCommand: CommandModule = {
  command: "review <spec>",
  describe: "Review a spec (self or teammate sign-off)",
  builder: (yargs) =>
    yargs
      .positional("spec", { type: "string", demandOption: true })
      .option("self", { type: "boolean", describe: "Self-review (solo mode)" })
      .option("decision", { type: "string", choices: ["approved", "changes-requested"] as const, default: "approved" }),
  handler: (argv) => {
    const cwd = process.cwd();
    const specPath = join(cwd, argv.spec as string);
    const spec = parseSpec(specPath);
    const reviewer = getCurrentUser(cwd) || "unknown";
    const date = new Date().toISOString().slice(0, 10);

    if (argv.self) {
      updateFrontmatter(specPath, { status: "ready" });
      console.log(chalk.green(`Self-reviewed: ${specPath} → ready`));
      return;
    }

    const decision = (argv.decision as string) === "approved" ? "approved" : "changes-requested";
    const newStatus: SpecStatus = decision === "approved" ? "approved" : "draft";

    updateFrontmatter(specPath, {
      status: newStatus,
      pinned_commit: decision === "approved" ? getHeadCommit(cwd) || null : spec.frontmatter.pinned_commit,
    });

    console.log(chalk.green(`Reviewed: ${specPath} → ${newStatus} (by ${reviewer})`));
  },
};

const completeCommand: CommandModule = {
  command: "complete <spec>",
  describe: "Mark a spec as complete and move to completed/",
  builder: (yargs) => yargs.positional("spec", { type: "string", demandOption: true }),
  handler: (argv) => {
    const cwd = process.cwd();
    const specPath = join(cwd, argv.spec as string);
    updateFrontmatter(specPath, { status: "complete" });
    const config = readConfig(cwd);
    const dest = join(cwd, config.paths.completed);
    mkdirSync(dest, { recursive: true });
    const newPath = join(dest, specPath.split("/").pop()!);
    renameSync(specPath, newPath);
    console.log(chalk.green(`Complete: ${newPath}`));
  },
};

const archiveCommand: CommandModule = {
  command: "archive <spec>",
  describe: "Archive a spec (rejected or superseded)",
  builder: (yargs) => yargs.positional("spec", { type: "string", demandOption: true }),
  handler: (argv) => {
    const cwd = process.cwd();
    const specPath = join(cwd, argv.spec as string);
    updateFrontmatter(specPath, { status: "archived" });
    const config = readConfig(cwd);
    const dest = join(cwd, config.paths.archived);
    mkdirSync(dest, { recursive: true });
    const newPath = join(dest, specPath.split("/").pop()!);
    renameSync(specPath, newPath);
    console.log(chalk.yellow(`Archived: ${newPath}`));
  },
};

export default {
  name: "workflow",
  description: "Review, complete, and archive specs",
  commands: { review: reviewCommand, complete: completeCommand, archive: archiveCommand },
};
```

- [ ] **Step 2: Commit**

```bash
git add src/plugins/workflow.ts
git commit -m "feat: add workflow plugin (review, complete, archive)"
```

---

### Task 13: Doctor plugin

**Files:**
- Create: `src/plugins/doctor.ts`
- Create: `tests/plugins/doctor.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// tests/plugins/doctor.test.ts
import { describe, it, expect } from "vitest";
import { computeDomainGroups, detectDuplicates, SpecSummary } from "../../src/plugins/doctor.js";

describe("computeDomainGroups", () => {
  it("groups specs by domain", () => {
    const specs: SpecSummary[] = [
      { filePath: "a.md", title: "A", domain: "auth", author: "alice", problemWords: [] },
      { filePath: "b.md", title: "B", domain: "auth", author: "bob", problemWords: [] },
      { filePath: "c.md", title: "C", domain: "api", author: "alice", problemWords: [] },
    ];
    const groups = computeDomainGroups(specs);
    expect(groups.auth).toBe(2);
    expect(groups.api).toBe(1);
  });
});

describe("detectDuplicates", () => {
  it("flags specs with high word overlap", () => {
    const specs: SpecSummary[] = [
      { filePath: "a.md", title: "User Auth", domain: "auth", author: "alice", problemWords: ["login", "password", "session"] },
      { filePath: "b.md", title: "Login System", domain: "auth", author: "bob", problemWords: ["login", "password", "token"] },
    ];
    const dupes = detectDuplicates(specs, 0.5);
    expect(dupes.length).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/plugins/doctor.test.ts
```
Expected: FAIL.

- [ ] **Step 3: Implement doctor plugin**

```typescript
// src/plugins/doctor.ts
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
      if (score > threshold) {
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

    // Spec count
    if (specs.length >= config.doctor.flat_max && config.mode === "flat") {
      console.log(chalk.yellow(`  ${specs.length} active specs (threshold: ${config.doctor.flat_max})`));
      console.log(chalk.yellow(`  Suggestion: consider switching to domain mode. Run: sdd config set mode domain\n`));
    }

    // Domain groups
    const groups = computeDomainGroups(specs);
    const domainCount = Object.keys(groups).filter((d) => d !== "uncategorized").length;
    if (domainCount >= 3 && config.mode === "flat") {
      const details = Object.entries(groups).map(([k, v]) => `    ${k}: ${v} specs`).join("\n");
      console.log(chalk.yellow(`  ${domainCount} domains detected:\n${details}`));
      console.log(chalk.yellow(`  Suggestion: switch to domain mode.\n`));
    }

    // Duplicates
    const dupes = detectDuplicates(specs, config.doctor.similarity_threshold);
    if (dupes.length > 0) {
      console.log(chalk.red(`  ${dupes.length} potential duplicate(s) detected:`));
      for (const d of dupes) {
        console.log(chalk.red(`    "${d.a.title}" ↔ "${d.b.title}" (similarity: ${d.score.toFixed(2)})`));
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
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run tests/plugins/doctor.test.ts
```
Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/plugins/doctor.ts tests/plugins/doctor.test.ts
git commit -m "feat: add doctor plugin with health checks"
```

---

## Phase 5: Extractors & Diff

### Task 14: TypeScript extractor

**Files:**
- Create: `extractors/typescript.ts`

- [ ] **Step 1: Implement TypeScript extractor**

```typescript
// extractors/typescript.ts

export interface InterfaceShape {
  name: string;
  kind: "function" | "route" | "type" | "constant";
  signature: string;
  file: string;
}

// Extract function signatures, route handlers, and exported types from TS source
export function parseTsInterfaces(content: string, filePath: string): InterfaceShape[] {
  const shapes: InterfaceShape[] = [];

  // Match exported functions: export function name(params): ReturnType
  const funcRe = /export\s+(?:async\s+)?function\s+(\w+)\s*\(([^)]*)\)\s*(?::\s*(\w+(?:<\w+>)?))?/g;
  for (const m of content.matchAll(funcRe)) {
    shapes.push({ name: m[1], kind: "function", signature: `${m[1]}(${m[2]}): ${m[3] || "void"}`, file: filePath });
  }

  // Match express/fastify route handlers: app.post("/path", handler)
  const routeRe = /(?:app|router)\.(get|post|put|delete|patch)\s*\(\s*["']([^"']+)["']/g;
  for (const m of content.matchAll(routeRe)) {
    shapes.push({ name: `${m[1].toUpperCase()} ${m[2]}`, kind: "route", signature: `${m[1].toUpperCase()} ${m[2]}`, file: filePath });
  }

  // Match arrow function exports: export const name = (params): ReturnType => {}
  const arrowRe = /export\s+const\s+(\w+)\s*=\s*(?:async\s*)?\(([^)]*)\)\s*(?::\s*(\w+(?:<\w+>)?))?\s*=>/g;
  for (const m of content.matchAll(arrowRe)) {
    shapes.push({ name: m[1], kind: "function", signature: `${m[1]}(${m[2]}): ${m[3] || "void"}`, file: filePath });
  }

  // Match exported constants (TTL, limits)
  const constRe = /export\s+const\s+(\w+)\s*(?::\s*[\w<>[\]]+)?\s*=\s*(.+?)(?:;|\n)/g;
  for (const m of content.matchAll(constRe)) {
    const val = m[2].trim();
    if (val.length < 60) {
      shapes.push({ name: m[1], kind: "constant", signature: `${m[1]} = ${val}`, file: filePath });
    }
  }

  return shapes;
}
```

- [ ] **Step 2: Commit**

```bash
git add extractors/typescript.ts
git commit -m "feat: add TypeScript code extractor"
```

---

### Task 15: Python extractor

**Files:**
- Create: `extractors/python.ts`

- [ ] **Step 1: Implement Python extractor**

```typescript
// extractors/python.ts
import type { InterfaceShape } from "./typescript.js";

export function parsePyInterfaces(content: string, filePath: string): InterfaceShape[] {
  const shapes: InterfaceShape[] = [];

  // def function_name(params) -> ReturnType:
  const funcRe = /def\s+(\w+)\s*\(([^)]*)\)\s*(?:->\s*(\w+(?:\[[\w,\s]+\])?))?\s*:/g;
  for (const m of content.matchAll(funcRe)) {
    shapes.push({ name: m[1], kind: "function", signature: `def ${m[1]}(${m[2]}) -> ${m[3] || "None"}`, file: filePath });
  }

  // Flask/FastAPI route decorators: @app.route("/path", methods=["GET"])
  const flaskRe = /@\w+\.(?:route|get|post|put|delete|patch)\s*\(\s*["']([^"']+)["']/g;
  for (const m of content.matchAll(flaskRe)) {
    shapes.push({ name: m[1], kind: "route", signature: m[1], file: filePath });
  }

  // Constants: NAME = value
  const constRe = /^(\w+)\s*[:]\s*\w+\s*=\s*(.+)$/gm; // typed constants
  for (const m of content.matchAll(constRe)) {
    shapes.push({ name: m[1], kind: "constant", signature: `${m[1]} = ${m[2].trim()}`, file: filePath });
  }

  return shapes;
}
```

- [ ] **Step 2: Commit**

```bash
git add extractors/python.ts
git commit -m "feat: add Python code extractor"
```

---

### Task 16: Diff plugin

**Files:**
- Create: `src/plugins/diff.ts`
- Create: `tests/plugins/diff.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// tests/plugins/diff.test.ts
import { describe, it, expect } from "vitest";
import { compareInterfaces, type InterfaceShape } from "../../src/plugins/diff.js";

describe("compareInterfaces", () => {
  it("returns empty when spec and code match", () => {
    const specShapes: InterfaceShape[] = [
      { name: "POST /login", kind: "route", signature: "POST /login", file: "spec" },
    ];
    const codeShapes: InterfaceShape[] = [
      { name: "POST /login", kind: "route", signature: "POST /login", file: "routes.ts" },
    ];
    const mismatches = compareInterfaces(specShapes, codeShapes);
    expect(mismatches).toHaveLength(0);
  });

  it("detects missing routes in code", () => {
    const specShapes: InterfaceShape[] = [
      { name: "POST /login", kind: "route", signature: "POST /login", file: "spec" },
      { name: "POST /register", kind: "route", signature: "POST /register", file: "spec" },
    ];
    const codeShapes: InterfaceShape[] = [
      { name: "POST /login", kind: "route", signature: "POST /login", file: "routes.ts" },
    ];
    const mismatches = compareInterfaces(specShapes, codeShapes);
    expect(mismatches.length).toBeGreaterThan(0);
    expect(mismatches[0].missing).toContain("POST /register");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/plugins/diff.test.ts
```
Expected: FAIL.

- [ ] **Step 3: Implement diff plugin**

```typescript
// src/plugins/diff.ts
import type { CommandModule } from "yargs";
import { parseSpec } from "../core/spec.js";
import { readConfig } from "../core/config.js";
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import chalk from "chalk";
import type { InterfaceShape } from "../../extractors/typescript.js";

export function compareInterfaces(
  specShapes: InterfaceShape[],
  codeShapes: InterfaceShape[]
): { missing: string[]; extra: string[] }[] {
  const specNames = new Set(specShapes.map((s) => s.name));
  const codeNames = new Set(codeShapes.map((s) => s.name));
  const missing = [...specNames].filter((n) => !codeNames.has(n));
  const extra = [...codeNames].filter((n) => !specNames.has(n));
  return [{ missing, extra }];
}

// Parse spec Interfaces section to extract named shapes
function parseSpecInterfaces(body: string): InterfaceShape[] {
  const shapes: InterfaceShape[] = [];
  const section = body.match(/### Interfaces\n([\s\S]*?)(?:###|##|$)/);
  if (!section) return shapes;

  // Look for patterns like: "- POST /login → { token, user }"
  // or "- functionName(params) → ReturnType"
  const lines = section[1].split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("- ")) {
      const content = trimmed.slice(2);
      const name = content.split(/[→:]/)[0].trim();
      if (name) {
        shapes.push({ name, kind: "route", signature: content, file: "spec" });
      }
    }
  }
  return shapes;
}

const diffCommand: CommandModule = {
  command: "diff <spec>",
  describe: "Check spec interfaces against code",
  builder: (yargs) => yargs.positional("spec", { type: "string", demandOption: true }),
  handler: async (argv) => {
    const cwd = process.cwd();
    const specPath = join(cwd, argv.spec as string);
    const spec = parseSpec(specPath);
    const specShapes = parseSpecInterfaces(spec.body);

    if (specShapes.length === 0) {
      console.log(chalk.yellow("No interfaces found in spec."));
      return;
    }

    // Collect code shapes from linked_files
    const codeShapes: InterfaceShape[] = [];
    const config = readConfig(cwd);

    for (const relPath of spec.frontmatter.linked_files) {
      const fullPath = join(cwd, relPath);
      if (!existsSync(fullPath)) {
        console.log(chalk.gray(`  Skipping missing file: ${relPath}`));
        continue;
      }

      const content = readFileSync(fullPath, "utf-8");
      const ext = relPath.slice(relPath.lastIndexOf("."));

      if (ext === ".ts" || ext === ".tsx") {
        const { parseTsInterfaces } = await import("../../extractors/typescript.js");
        codeShapes.push(...parseTsInterfaces(content, fullPath));
      } else if (ext === ".py") {
        const { parsePyInterfaces } = await import("../../extractors/python.js");
        codeShapes.push(...parsePyInterfaces(content, fullPath));
      }
    }

    const results = compareInterfaces(specShapes, codeShapes);

    if (results[0].missing.length === 0) {
      console.log(chalk.green("Spec interfaces match code."));
    } else {
      console.log(chalk.red(`Mismatches detected:`));
      if (results[0].missing.length > 0) {
        console.log(chalk.yellow(`  In spec but not in code: ${results[0].missing.join(", ")}`));
      }
      if (results[0].extra.length > 0) {
        console.log(chalk.yellow(`  In code but not in spec: ${results[0].extra.join(", ")}`));
      }
    }
  },
};

export default {
  name: "diff",
  description: "Detect spec vs code mismatches",
  commands: { diff: diffCommand },
};
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run tests/plugins/diff.test.ts
```
Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/plugins/diff.ts tests/plugins/diff.test.ts
git commit -m "feat: add diff plugin with code extractors"
```

---

## Phase 6: Polish

### Task 17: Smoke test + final wiring

- [ ] **Step 1: Run full test suite**

```bash
npx vitest run
```
Expected: all tests PASS.

- [ ] **Step 2: End-to-end smoke test**

```bash
rm -rf /tmp/sdd-e2e && mkdir /tmp/sdd-e2e && cd /tmp/sdd-e2e

# Init
npx tsx ~/sdd_learning/src/index.ts init
test -d specs/active && echo "PASS: specs/active exists"
test -f .sdd/config.yaml && echo "PASS: config exists"
test -f CLAUDE.md && echo "PASS: CLAUDE.md exists"

# New
npx tsx ~/sdd_learning/src/index.ts new "test-feature"
ls specs/active/*-test-feature.md > /dev/null && echo "PASS: spec created"

# Status
npx tsx ~/sdd_learning/src/index.ts status | grep -q "test-feature" && echo "PASS: status shows spec"

# Amend
SPEC=$(ls specs/active/*-test-feature.md)
npx tsx ~/sdd_learning/src/index.ts amend "$SPEC" -m "test change"
grep -q "test change" "$SPEC" && echo "PASS: changelog updated"

echo "All smoke tests passed."
```
Expected: all PASS messages.

- [ ] **Step 3: Final commit**

```bash
git add -A
git commit -m "feat: complete SDD CLI framework v0.1.0

Includes:
- Core CLI: init, new, status, amend
- Plugins: workflow, doctor, diff
- Extractors: TypeScript, Python
- Scaffold with templates and CLAUDE.md generation"
```
