import { describe, it, expect } from "vitest";
import { parseJavaInterfaces } from "../../src/extractors/java.js";

describe("parseJavaInterfaces", () => {
  it("extracts public methods from classes", async () => {
    const code = `
public class UserController {
    public User getUser(String id) {
        return null;
    }

    public void deleteUser(String id) {
    }
}
`;
    const shapes = await parseJavaInterfaces(code, "UserController.java");
    expect(shapes).toHaveLength(2);
    expect(shapes[0].name).toBe("getUser");
    expect(shapes[0].kind).toBe("function");
    expect(shapes[1].name).toBe("deleteUser");
  });

  it("extracts Spring MVC route annotations", async () => {
    const code = `
@RestController
@RequestMapping("/api/users")
public class UserController {
    @GetMapping("/{id}")
    public User getUser(@PathVariable String id) {
        return null;
    }

    @PostMapping
    public User createUser(@RequestBody User user) {
        return null;
    }

    @PutMapping("/{id}")
    public User updateUser(@PathVariable String id, @RequestBody User user) {
        return null;
    }

    @DeleteMapping("/{id}")
    public void deleteUser(@PathVariable String id) {
    }
}
`;
    const shapes = await parseJavaInterfaces(code, "UserController.java");
    const routes = shapes.filter((s) => s.kind === "route");
    expect(routes).toHaveLength(4);
    expect(routes.map((r) => r.name)).toContain("GET /api/users/{id}");
    expect(routes.map((r) => r.name)).toContain("POST /api/users");
  });

  it("extracts interface method signatures", async () => {
    const code = `
public interface UserService {
    User findById(Long id);
    List<User> findAll();
    void delete(Long id);
}
`;
    const shapes = await parseJavaInterfaces(code, "UserService.java");
    expect(shapes).toHaveLength(3);
    expect(shapes[0].name).toBe("findById");
    expect(shapes[1].name).toBe("findAll");
  });

  it("extracts public static final constants", async () => {
    const code = `
public class Config {
    public static final int MAX_RETRIES = 3;
    public static final String API_VERSION = "v2";
}
`;
    const shapes = await parseJavaInterfaces(code, "Config.java");
    const constants = shapes.filter((s) => s.kind === "constant");
    expect(constants).toHaveLength(2);
    expect(constants.map((c) => c.name)).toContain("MAX_RETRIES");
    expect(constants.map((c) => c.name)).toContain("API_VERSION");
  });
});
