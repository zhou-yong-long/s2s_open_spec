import type { InterfaceShape } from "./typescript.js";

export function parsePyInterfaces(content: string, filePath: string): InterfaceShape[] {
  const shapes: InterfaceShape[] = [];

  // def function_name(params) -> ReturnType:
  const funcRe = /def\s+(\w+)\s*\(([^)]*)\)\s*(?:->\s*(\w+(?:\[[\w,\s]+\])?))?\s*:/g;
  for (const m of content.matchAll(funcRe)) {
    shapes.push({ name: m[1], kind: "function", signature: `def ${m[1]}(${m[2]}) -> ${m[3] || "None"}`, file: filePath });
  }

  // Flask/FastAPI route decorators: @app.route("/path", methods=["GET"])
  const flaskRe = /@\w+\.(?:route|get|post|put|delete|patch)\s*\(\s*["']([^"']+)["']/g;
  for (const m of content.matchAll(flaskRe)) {
    shapes.push({ name: m[1], kind: "route", signature: m[1], file: filePath });
  }

  // Typed constants: NAME: type = value
  const constRe = /^(\w+)\s*:\s*\w+\s*=\s*(.+)$/gm;
  for (const m of content.matchAll(constRe)) {
    shapes.push({ name: m[1], kind: "constant", signature: `${m[1]} = ${m[2].trim()}`, file: filePath });
  }

  return shapes;
}
