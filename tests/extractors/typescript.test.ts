import { describe, it, expect } from "vitest";
import { parseTsInterfaces } from "../../src/extractors/typescript.js";

describe("parseTsInterfaces", () => {
  it("extracts exported functions", () => {
    const code = `
export function getUser(id: string): User {
    return {} as User;
}

export async function deleteUser(id: string): Promise<void> {
}
`;
    const shapes = parseTsInterfaces(code, "users.ts");
    expect(shapes).toHaveLength(2);
    expect(shapes[0].name).toBe("getUser");
    expect(shapes[0].kind).toBe("function");
    expect(shapes[0].params).toBe("id: string");
    expect(shapes[0].returnType).toBe("User");
    expect(shapes[1].name).toBe("deleteUser");
    expect(shapes[1].isAsync).toBe(true);
  });

  it("extracts exported arrow functions", () => {
    const code = `
export const healthCheck = (req: Request, res: Response): void => {
    res.status(200).json({ status: "ok" });
};
`;
    const shapes = parseTsInterfaces(code, "health.ts");
    expect(shapes).toHaveLength(1);
    expect(shapes[0].name).toBe("healthCheck");
    expect(shapes[0].params).toBe("req: Request, res: Response");
    expect(shapes[0].returnType).toBe("void");
  });

  it("extracts Express route handlers", () => {
    const code = `
const app = express();

app.get("/users", getUsers);
app.post("/users", createUser);
app.put("/users/:id", updateUser);
app.delete("/users/:id", deleteUser);
`;
    const shapes = parseTsInterfaces(code, "routes.ts");
    const routes = shapes.filter((s) => s.kind === "route");
    expect(routes).toHaveLength(4);
    expect(routes.map((r) => r.name)).toContain("GET /users");
    expect(routes.map((r) => r.name)).toContain("POST /users");
    expect(routes.map((r) => r.name)).toContain("DELETE /users/:id");
  });

  it("extracts exported constants", () => {
    const code = `
export const MAX_RETRIES = 3;
export const API_VERSION = "v2";
export const complexConfig = { retries: 3, timeout: 5000, name: "test", extra: true, more: "data" };
`;
    const shapes = parseTsInterfaces(code, "config.ts");
    const constants = shapes.filter((s) => s.kind === "constant");
    expect(constants).toHaveLength(2);
    expect(constants.map((c) => c.name)).toContain("MAX_RETRIES");
    expect(constants.map((c) => c.name)).toContain("API_VERSION");
  });

  it("handles generic types in parameters", () => {
    const code = `
export function processItems(items: Array<string>, callback: (item: string) => void): Promise<Map<string, number>> {
    return Promise.resolve(new Map());
}
`;
    const shapes = parseTsInterfaces(code, "generic.ts");
    expect(shapes).toHaveLength(1);
    expect(shapes[0].params).toContain("Array<string>");
    expect(shapes[0].returnType).toBe("Promise<Map<string, number>>");
  });

  it("does not extract non-exported functions", () => {
    const code = `
function internalHelper() {
    return true;
}

export function publicApi(): boolean {
    return internalHelper();
}
`;
    const shapes = parseTsInterfaces(code, "module.ts");
    expect(shapes).toHaveLength(1);
    expect(shapes[0].name).toBe("publicApi");
  });
});
