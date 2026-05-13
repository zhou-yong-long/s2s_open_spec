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

    run("sync-specs", testDir);

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
