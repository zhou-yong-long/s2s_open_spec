import { describe, it, expect } from "vitest";
import { parseGoInterfaces } from "../../src/extractors/go.js";

describe("parseGoInterfaces", () => {
  it("extracts exported functions", async () => {
    const code = `
package user

func GetUser(id string) (*User, error) {
    return nil, nil
}

func DeleteUser(id string) error {
    return nil
}
`;
    const shapes = await parseGoInterfaces(code, "user.go");
    expect(shapes).toHaveLength(2);
    expect(shapes[0].name).toBe("GetUser");
    expect(shapes[0].kind).toBe("function");
    expect(shapes[1].name).toBe("DeleteUser");
  });

  it("extracts Gin/echo route registrations", async () => {
    const code = `
func SetupRoutes(r *gin.Engine) {
    r.GET("/api/users", GetUsers)
    r.POST("/api/users", CreateUser)
    r.PUT("/api/users/:id", UpdateUser)
    r.DELETE("/api/users/:id", DeleteUser)
}
`;
    const shapes = await parseGoInterfaces(code, "routes.go");
    const routes = shapes.filter((s) => s.kind === "route");
    expect(routes).toHaveLength(4);
    expect(routes.map((r) => r.name)).toContain("GET /api/users");
    expect(routes.map((r) => r.name)).toContain("DELETE /api/users/:id");
  });

  it("extracts exported constants", async () => {
    const code = `
package config

const MaxRetries = 3
const APIVersion = "v2"
`;
    const shapes = await parseGoInterfaces(code, "config.go");
    const constants = shapes.filter((s) => s.kind === "constant");
    expect(constants).toHaveLength(2);
    expect(constants.map((c) => c.name)).toContain("MaxRetries");
  });

  it("extracts interface type definitions", async () => {
    const code = `
type UserService interface {
    FindByID(id int64) (*User, error)
    FindAll() ([]User, error)
    Delete(id int64) error
}
`;
    const shapes = await parseGoInterfaces(code, "service.go");
    const interfaces = shapes.filter((s) => s.kind === "type");
    expect(interfaces).toHaveLength(3);
    expect(interfaces[0].name).toBe("FindByID");
    expect(interfaces[1].name).toBe("FindAll");
  });
});
