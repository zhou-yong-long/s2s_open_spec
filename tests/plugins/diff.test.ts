import { describe, it, expect } from "vitest";
import { compareInterfaces, type DiffResult, type InterfaceShape } from "../../src/plugins/diff.js";

describe("compareInterfaces", () => {
  it("returns empty when spec and code match", () => {
    const specShapes: InterfaceShape[] = [
      { name: "POST /login", kind: "route", signature: "POST /login", file: "spec" },
    ];
    const codeShapes: InterfaceShape[] = [
      { name: "POST /login", kind: "route", signature: "POST /login", file: "routes.ts" },
    ];
    const result = compareInterfaces(specShapes, codeShapes);
    expect(result.missing).toHaveLength(0);
    expect(result.extra).toHaveLength(0);
    expect(result.signatureMismatch).toHaveLength(0);
  });

  it("detects missing routes in code", () => {
    const specShapes: InterfaceShape[] = [
      { name: "POST /login", kind: "route", signature: "POST /login", file: "spec" },
      { name: "POST /register", kind: "route", signature: "POST /register", file: "spec" },
    ];
    const codeShapes: InterfaceShape[] = [
      { name: "POST /login", kind: "route", signature: "POST /login", file: "routes.ts" },
    ];
    const result = compareInterfaces(specShapes, codeShapes);
    expect(result.missing).toHaveLength(1);
    expect(result.missing[0].name).toBe("POST /register");
  });

  it("detects extra routes in code", () => {
    const specShapes: InterfaceShape[] = [
      { name: "POST /login", kind: "route", signature: "POST /login", file: "spec" },
    ];
    const codeShapes: InterfaceShape[] = [
      { name: "POST /login", kind: "route", signature: "POST /login", file: "routes.ts" },
      { name: "GET /admin", kind: "route", signature: "GET /admin", file: "routes.ts" },
    ];
    const result = compareInterfaces(specShapes, codeShapes);
    expect(result.extra).toHaveLength(1);
    expect(result.extra[0].name).toBe("GET /admin");
  });

  it("detects signature mismatches", () => {
    const specShapes: InterfaceShape[] = [
      { name: "getUser", kind: "function", signature: "getUser(id: string): User", file: "spec", params: "id: string", returnType: "User" },
    ];
    const codeShapes: InterfaceShape[] = [
      { name: "getUser", kind: "function", signature: "getUser(id: number): User", file: "routes.ts", params: "id: number", returnType: "User" },
    ];
    const result = compareInterfaces(specShapes, codeShapes);
    expect(result.signatureMismatch).toHaveLength(1);
    expect(result.signatureMismatch[0].name).toBe("getUser");
  });
});
