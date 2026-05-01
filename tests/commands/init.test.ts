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
