import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  scanSrcDomains,
  scanSpecDomains,
  buildIndex,
  writeIndex,
  readIndex,
  shouldDebounce,
} from "../../src/core/hive-index.js";
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

describe("scanSpecDomains", () => {
  it("extracts unique domain values from spec frontmatter", () => {
    const specsDir = join(testDir, "specs/active");
    mkdirSync(specsDir, { recursive: true });

    writeFileSync(
      join(specsDir, "2026-05-01-auth.md"),
      `---
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
`
    );

    writeFileSync(
      join(specsDir, "2026-05-02-billing.md"),
      `---
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
`
    );

    writeFileSync(
      join(specsDir, "2026-05-03-no-domain.md"),
      `---
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
`
    );

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
    writeFileSync(
      join(specsDir, "2026-05-01-auth.md"),
      `---
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
`
    );

    const index = buildIndex(testDir, {
      srcDir: "src",
      specsDir: "specs/active",
    });
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
    const index = buildIndex(testDir, {
      srcDir: "src",
      specsDir: "specs/active",
    });

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
