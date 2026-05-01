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
