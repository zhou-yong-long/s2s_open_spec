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
