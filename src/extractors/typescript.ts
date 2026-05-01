export interface InterfaceShape {
  name: string;
  kind: "function" | "route" | "type" | "constant";
  signature: string;
  file: string;
}

// Extract function signatures, route handlers, and exported types from TS source
export function parseTsInterfaces(content: string, filePath: string): InterfaceShape[] {
  const shapes: InterfaceShape[] = [];

  // Match exported functions: export function name(params): ReturnType
  const funcRe = /export\s+(?:async\s+)?function\s+(\w+)\s*\(([^)]*)\)\s*(?::\s*(\w+(?:<\w+>)?))?/g;
  for (const m of content.matchAll(funcRe)) {
    shapes.push({ name: m[1], kind: "function", signature: `${m[1]}(${m[2]}): ${m[3] || "void"}`, file: filePath });
  }

  // Match express/fastify route handlers: app.post("/path", handler)
  const routeRe = /(?:app|router)\.(get|post|put|delete|patch)\s*\(\s*["']([^"']+)["']/g;
  for (const m of content.matchAll(routeRe)) {
    shapes.push({ name: `${m[1].toUpperCase()} ${m[2]}`, kind: "route", signature: `${m[1].toUpperCase()} ${m[2]}`, file: filePath });
  }

  // Match arrow function exports: export const name = (params): ReturnType => {}
  const arrowRe = /export\s+const\s+(\w+)\s*=\s*(?:async\s*)?\(([^)]*)\)\s*(?::\s*(\w+(?:<\w+>)?))?\s*=>/g;
  for (const m of content.matchAll(arrowRe)) {
    shapes.push({ name: m[1], kind: "function", signature: `${m[1]}(${m[2]}): ${m[3] || "void"}`, file: filePath });
  }

  // Match exported constants (TTL, limits)
  const constRe = /export\s+const\s+(\w+)\s*(?::\s*[\w<>[\]]+)?\s*=\s*(.+?)(?:;|\n)/g;
  for (const m of content.matchAll(constRe)) {
    const val = m[2].trim();
    if (val.length < 60) {
      shapes.push({ name: m[1], kind: "constant", signature: `${m[1]} = ${val}`, file: filePath });
    }
  }

  return shapes;
}
