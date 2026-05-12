import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { existsSync, readdirSync, rmSync, mkdirSync, readFileSync } from "fs";
import { join } from "path";
import { execSync } from "child_process";
import { sanitizeSpecSlug, outputFilenameForType, NEW_SPEC_TYPES } from "../../src/commands/new.js";

const testDir = join(process.cwd(), "tests/fixtures/new-test");
const sddBin = join(process.cwd(), "src/index.ts");

function run(args: string, cwd: string) {
  return execSync(`npx tsx ${sddBin} ${args}`, { cwd, encoding: "utf-8", env: { ...process.env, FORCE_COLOR: "0", EDITOR: "echo" } });
}

function runExpectFail(args: string, cwd: string) {
  return expect(() => {
    execSync(`npx tsx ${sddBin} ${args}`, { cwd, encoding: "utf-8", env: { ...process.env, FORCE_COLOR: "0", EDITOR: "echo" } });
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

describe("sanitizeSpecSlug", () => {
  it("normalizes spaces and case", () => {
    expect(sanitizeSpecSlug("User Auth")).toBe("user-auth");
  });
  it("strips non-alphanumeric except hyphen", () => {
    expect(sanitizeSpecSlug("Foo 2.0 (beta)!")).toBe("foo-20-beta");
  });
  it("returns empty when nothing remains", () => {
    expect(sanitizeSpecSlug("!!!")).toBe("");
    expect(sanitizeSpecSlug("   ")).toBe("");
  });
});

describe("outputFilenameForType", () => {
  it("uses pm- and qa- prefixes for PM and QA templates", () => {
    expect(outputFilenameForType("feature-spec", "2026-05-11", "login")).toBe("2026-05-11-login.md");
    expect(outputFilenameForType("feature-spec-pm", "2026-05-11", "login")).toBe("2026-05-11-pm-login.md");
    expect(outputFilenameForType("qa-from-spec", "2026-05-11", "login")).toBe("2026-05-11-qa-login.md");
    expect(outputFilenameForType("design-doc", "2026-05-11", "cache")).toBe("2026-05-11-cache.md");
  });
});

describe("NEW_SPEC_TYPES", () => {
  it("includes pm and qa types", () => {
    expect(NEW_SPEC_TYPES).toContain("feature-spec-pm");
    expect(NEW_SPEC_TYPES).toContain("qa-from-spec");
  });
});

describe("sdd new", () => {
  it("creates a spec file in specs/active/", () => {
    run("new user-auth", testDir);
    const files = readdirSync(join(testDir, "specs/active"));
    const specFile = files.find((f) => f.endsWith("user-auth.md"));
    expect(specFile).toBeDefined();
    expect(specFile).toMatch(/^\d{4}-\d{2}-\d{2}-user-auth\.md$/);
  });

  it("creates a PM spec with --type feature-spec-pm", () => {
    run("new billing-rollout --type feature-spec-pm", testDir);
    const files = readdirSync(join(testDir, "specs/active"));
    const specFile = files.find((f) => f.includes("pm-billing-rollout"));
    expect(specFile).toBeDefined();
    const body = readFileSync(join(testDir, "specs/active", specFile!), "utf-8");
    expect(body).toContain("## Acceptance criteria");
    expect(body).toContain("## Goals and non-goals");
  });

  it("creates a QA checklist with --type qa-from-spec", () => {
    run("new login-flow --type qa-from-spec", testDir);
    const files = readdirSync(join(testDir, "specs/active"));
    const specFile = files.find((f) => f.includes("qa-login-flow"));
    expect(specFile).toBeDefined();
    const body = readFileSync(join(testDir, "specs/active", specFile!), "utf-8");
    expect(body).toContain("QA checklist");
    expect(body).toContain("## Traceability");
  });

  it("accepts quoted multi-word titles for the positional name", () => {
    run('new "Billing Rollout" --type feature-spec-pm', testDir);
    const files = readdirSync(join(testDir, "specs/active"));
    const specFile = files.find((f) => f.includes("pm-billing-rollout"));
    expect(specFile).toBeDefined();
    const body = readFileSync(join(testDir, "specs/active", specFile!), "utf-8");
    expect(body).toContain("# Billing Rollout");
  });

  it("exits non-zero when name sanitizes to empty", () => {
    runExpectFail('new "!!!"', testDir).toThrow();
  });

  it("refuses to overwrite an existing spec file", () => {
    run("new user-auth", testDir);
    runExpectFail("new user-auth", testDir).toThrow();
  });

  it("refuses to overwrite an existing PM spec file", () => {
    run("new user-auth --type feature-spec-pm", testDir);
    runExpectFail("new user-auth --type feature-spec-pm", testDir).toThrow();
  });

  it("refuses cross-type collision between feature-spec and design-doc", () => {
    run("new user-auth", testDir);
    runExpectFail("new user-auth --type design-doc", testDir).toThrow();
  });

  it("allows different roles to create specs with same title", () => {
    run("new user-auth", testDir);
    run("new user-auth --type feature-spec-pm", testDir);
    run("new user-auth --type qa-from-spec", testDir);
    const files = readdirSync(join(testDir, "specs/active"));
    expect(files.filter((f) => f.includes("user-auth"))).toHaveLength(3);
  });
});
