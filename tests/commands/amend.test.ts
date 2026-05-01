import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { readdirSync, rmSync, mkdirSync, readFileSync } from "fs";
import { join } from "path";
import { execSync } from "child_process";
import { parseSpec } from "../../src/core/spec.js";

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

    run(`amend "${specPath}" -m "Added remember_me param"`, testDir);

    const spec = parseSpec(join(testDir, specPath));
    expect(spec.changelog.length).toBeGreaterThan(0);
    expect(spec.changelog[spec.changelog.length - 1].change).toContain("remember_me");
  });
});
