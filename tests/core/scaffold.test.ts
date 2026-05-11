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
    expect(existsSync(join(testDir, "SDD-PM.md"))).toBe(true);
    expect(existsSync(join(testDir, "SDD-QA.md"))).toBe(true);
  });
});
