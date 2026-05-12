import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { readConfig, writeConfig, defaultConfig } from "../../src/core/config.js";
import { mkdirSync, writeFileSync, rmSync } from "fs";
import { join } from "path";

const testDir = join(process.cwd(), "tests/fixtures/config-test");

function writeTestConfig(path: string, content: string) {
  mkdirSync(join(path, ".sdd"), { recursive: true });
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
    expect(config.plugins.workflow).toBe(true);
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
