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
