import { describe, it, expect } from "vitest";
import { compareInterfaces, type InterfaceShape } from "../../src/plugins/diff.js";

describe("compareInterfaces", () => {
  it("returns empty when spec and code match", () => {
    const specShapes: InterfaceShape[] = [
      { name: "POST /login", kind: "route", signature: "POST /login", file: "spec" },
    ];
    const codeShapes: InterfaceShape[] = [
      { name: "POST /login", kind: "route", signature: "POST /login", file: "routes.ts" },
    ];
    const mismatches = compareInterfaces(specShapes, codeShapes);
    expect(mismatches[0].missing).toHaveLength(0);
    expect(mismatches[0].extra).toHaveLength(0);
  });

  it("detects missing routes in code", () => {
    const specShapes: InterfaceShape[] = [
      { name: "POST /login", kind: "route", signature: "POST /login", file: "spec" },
      { name: "POST /register", kind: "route", signature: "POST /register", file: "spec" },
    ];
    const codeShapes: InterfaceShape[] = [
      { name: "POST /login", kind: "route", signature: "POST /login", file: "routes.ts" },
    ];
    const mismatches = compareInterfaces(specShapes, codeShapes);
    expect(mismatches.length).toBeGreaterThan(0);
    expect(mismatches[0].missing).toContain("POST /register");
  });
});
