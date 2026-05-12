import { describe, it, expect } from "vitest";
import { parsePyInterfaces } from "../../src/extractors/python.js";

describe("parsePyInterfaces", () => {
  it("extracts function definitions", async () => {
    const code = `
def get_user(user_id: int) -> User:
    pass

def delete_user(user_id: int) -> None:
    pass
`;
    const shapes = await parsePyInterfaces(code, "users.py");
    expect(shapes).toHaveLength(2);
    expect(shapes[0].name).toBe("get_user");
    expect(shapes[0].kind).toBe("function");
    expect(shapes[1].name).toBe("delete_user");
  });

  it("extracts async functions", async () => {
    const code = `
async def fetch_data(url: str) -> dict:
    pass
`;
    const shapes = await parsePyInterfaces(code, "async_module.py");
    expect(shapes).toHaveLength(1);
    expect(shapes[0].name).toBe("fetch_data");
    expect(shapes[0].isAsync).toBe(true);
  });

  it("extracts Flask/FastAPI route decorators", async () => {
    const code = `
@app.route("/users", methods=["GET"])
def get_users():
    pass

@app.get("/users/<id>")
def get_user(id: str):
    pass

@app.post("/users")
def create_user():
    pass
`;
    const shapes = await parsePyInterfaces(code, "routes.py");
    const routes = shapes.filter((s) => s.kind === "route");
    expect(routes).toHaveLength(3);
    expect(routes.map((r) => r.name)).toContain("GET /users");
    expect(routes.map((r) => r.name)).toContain("GET /users/<id>");
    expect(routes.map((r) => r.name)).toContain("POST /users");
  });

  it("extracts uppercase constants", async () => {
    const code = `
MAX_RETRIES = 3
API_VERSION = "v2"
timeout = 30
`;
    const shapes = await parsePyInterfaces(code, "config.py");
    const constants = shapes.filter((s) => s.kind === "constant");
    expect(constants).toHaveLength(2);
    expect(constants.map((c) => c.name)).toContain("MAX_RETRIES");
    expect(constants.map((c) => c.name)).toContain("API_VERSION");
  });
});
