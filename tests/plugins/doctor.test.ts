import { describe, it, expect } from "vitest";
import { computeDomainGroups, detectDuplicates, type SpecSummary } from "../../src/plugins/doctor.js";

describe("computeDomainGroups", () => {
  it("groups specs by domain", () => {
    const specs: SpecSummary[] = [
      { filePath: "a.md", title: "A", domain: "auth", author: "alice", problemWords: [] },
      { filePath: "b.md", title: "B", domain: "auth", author: "bob", problemWords: [] },
      { filePath: "c.md", title: "C", domain: "api", author: "alice", problemWords: [] },
    ];
    const groups = computeDomainGroups(specs);
    expect(groups.auth).toBe(2);
    expect(groups.api).toBe(1);
  });
});

describe("detectDuplicates", () => {
  it("flags specs with high word overlap", () => {
    const specs: SpecSummary[] = [
      { filePath: "a.md", title: "User Auth", domain: "auth", author: "alice", problemWords: ["login", "password", "session"] },
      { filePath: "b.md", title: "Login System", domain: "auth", author: "bob", problemWords: ["login", "password", "token"] },
    ];
    const dupes = detectDuplicates(specs, 0.5);
    expect(dupes.length).toBe(1);
  });
});
