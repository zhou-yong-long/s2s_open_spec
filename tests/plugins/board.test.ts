import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { scanSpecs, renderTerminal, type BoardSpec } from "../../src/plugins/board.js";
import { mkdirSync, writeFileSync, rmSync } from "fs";
import { join } from "path";

const testDir = join(process.cwd(), "tests/fixtures/board-test");

beforeEach(() => {
  rmSync(testDir, { recursive: true, force: true });
  mkdirSync(join(testDir, "specs/active"), { recursive: true });
});

afterEach(() => {
  rmSync(testDir, { recursive: true, force: true });
});

function writeSpec(dir: string, name: string, frontmatter: Record<string, unknown>, body: string) {
  const base: Record<string, unknown> = {
    status: "draft",
    author: "test",
    created: "2026-05-12",
    domain: null,
    tags: [],
    links: { parent: null, related: [] },
    pinned_commit: null,
    linked_files: [],
  };
  const merged = { ...base, ...frontmatter };
  const lines = Object.entries(merged).map(([k, v]) => {
    if (v === null) return `${k}: null`;
    if (Array.isArray(v)) return `${k}: []`;
    if (typeof v === "object") return `${k}:\n  parent: null\n  related: []`;
    if (typeof v === "string") return `${k}: ${v}`;
    return `${k}: ${JSON.stringify(v)}`;
  });
  writeFileSync(join(dir, name), `---\n${lines.join("\n")}\n---\n${body}`);
}

describe("scanSpecs", () => {
  it("returns empty array when no specs exist", () => {
    const specs = scanSpecs(testDir);
    expect(specs).toEqual([]);
  });

  it("scans active specs with frontmatter", () => {
    writeSpec(join(testDir, "specs/active"), "auth-spec.md", { status: "draft", author: "alice" }, "# Auth Spec\n\n## Problem\n...");
    const specs = scanSpecs(testDir);
    expect(specs.length).toBe(1);
    expect(specs[0].title).toBe("Auth Spec");
    expect(specs[0].status).toBe("draft");
    expect(specs[0].author).toBe("alice");
    expect(specs[0].fileName).toBe("auth-spec.md");
  });

  it("recursively scans subdirectories", () => {
    mkdirSync(join(testDir, "specs/active/sub"), { recursive: true });
    writeSpec(join(testDir, "specs/active"), "a.md", { status: "ready" }, "# A");
    writeSpec(join(testDir, "specs/active/sub"), "b.md", { status: "approved" }, "# B");
    const specs = scanSpecs(testDir);
    expect(specs.length).toBe(2);
    const statuses = specs.map(s => s.status);
    expect(statuses).toContain("ready");
    expect(statuses).toContain("approved");
  });

  it("filters by domain", () => {
    writeSpec(join(testDir, "specs/active"), "a.md", { status: "draft", domain: "auth" }, "# A");
    writeSpec(join(testDir, "specs/active"), "b.md", { status: "draft", domain: "api" }, "# B");
    const specs = scanSpecs(testDir, { domain: "auth" });
    expect(specs.length).toBe(1);
    expect(specs[0].domain).toBe("auth");
  });

  it("filters by author", () => {
    writeSpec(join(testDir, "specs/active"), "a.md", { status: "draft", author: "alice" }, "# A");
    writeSpec(join(testDir, "specs/active"), "b.md", { status: "draft", author: "bob" }, "# B");
    const specs = scanSpecs(testDir, { author: "alice" });
    expect(specs.length).toBe(1);
    expect(specs[0].author).toBe("alice");
  });

  it("filters by status", () => {
    writeSpec(join(testDir, "specs/active"), "a.md", { status: "draft" }, "# A");
    writeSpec(join(testDir, "specs/active"), "b.md", { status: "approved" }, "# B");
    const specs = scanSpecs(testDir, { status: "draft" });
    expect(specs.length).toBe(1);
    expect(specs[0].status).toBe("draft");
  });
});

describe("renderTerminal", () => {
  it("renders empty board message", () => {
    const specs: BoardSpec[] = [];
    const output = renderTerminal(specs, {});
    expect(output).toContain("No active specs found");
  });

  it("renders specs grouped by status", () => {
    const specs: BoardSpec[] = [
      { fileName: "a.md", title: "Auth", status: "draft", author: "alice", domain: null, created: "2026-05-01", tags: [] },
      { fileName: "b.md", title: "API", status: "approved", author: "bob", domain: "api", created: "2026-05-02", tags: ["urgent"] },
    ];
    const output = renderTerminal(specs, {});
    expect(output).toContain("draft");
    expect(output).toContain("approved");
    expect(output).toContain("Auth");
    expect(output).toContain("API");
  });

  it("shows summary line", () => {
    const specs: BoardSpec[] = [
      { fileName: "a.md", title: "A", status: "draft", author: "x", domain: null, created: "", tags: [] },
      { fileName: "b.md", title: "B", status: "draft", author: "y", domain: null, created: "", tags: [] },
    ];
    const output = renderTerminal(specs, {});
    expect(output).toMatch(/Total:\s*2/);
    expect(output).toMatch(/draft:\s*2/);
  });

  it("truncates long titles in narrow columns", () => {
    const specs: BoardSpec[] = [
      { fileName: "a.md", title: "This Is A Very Long Spec Title That Should Be Truncated", status: "draft", author: "x", domain: null, created: "", tags: [] },
    ];
    const output = renderTerminal(specs, { colWidth: 16 });
    expect(output.length).toBeGreaterThan(0);
  });
});
