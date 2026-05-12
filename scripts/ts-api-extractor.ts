#!/usr/bin/env tsx
/**
 * Demonstrates using the native TypeScript Compiler API to extract:
 *   - Exported functions (name, params with types, return type)
 *   - Express/Fastify route handlers (app.get/post/etc with path)
 *   - Exported arrow functions
 *   - Exported constants
 *
 * Run: npx tsx scripts/ts-api-extractor.ts
 */
import ts from "typescript";
import { readFileSync } from "fs";
import { join, resolve } from "path";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ExtractedFunction {
  name: string;
  kind: "function" | "arrow";
  params: { name: string; type: string; optional: boolean }[];
  returnType: string;
  isAsync: boolean;
  file: string;
}

interface ExtractedRoute {
  method: string;
  path: string;
  handlerName: string | null; // the function/arrow name if inferable
  file: string;
}

interface ExtractedConstant {
  name: string;
  type: string; // inferred or explicit type annotation
  value: string; // truncated source text
  file: string;
}

interface ExtractionResult {
  functions: ExtractedFunction[];
  routes: ExtractedRoute[];
  constants: ExtractedConstant[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Convert a ts.TypeNode back to a readable string.
 * e.g. `string`, `SpecStatus`, `Record<string, unknown>`, etc.
 */
function typeNodeToString(node: ts.TypeNode | undefined): string {
  if (!node) return "unknown";
  const sourceFile = node.getSourceFile();
  const full = sourceFile.getText();
  const slice = full.slice(node.getStart(sourceFile), node.getEnd());
  return slice;
}

/**
 * Convert a ts.ParameterDeclaration to a plain object.
 */
function paramToString(param: ts.ParameterDeclaration): { name: string; type: string; optional: boolean } {
  const sourceFile = param.getSourceFile();
  const full = sourceFile.getText();
  const nameSpan = full.slice(param.name.getStart(sourceFile), param.name.getEnd());
  return {
    name: nameSpan,
    type: typeNodeToString(param.type),
    optional: param.questionToken !== undefined || param.initializer !== undefined,
  };
}

/**
 * Check if a CallExpression looks like `app.get("/path", handler)` or similar.
 */
function isRouteCall(node: ts.CallExpression): { method: string; path: string } | null {
  const expr = node.expression;
  if (!ts.isPropertyAccessExpression(expr)) return null;

  const methodName = expr.name.getText(expr.getSourceFile());
  const httpMethods = new Set(["get", "post", "put", "delete", "patch", "head", "options", "all"]);
  if (!httpMethods.has(methodName.toLowerCase())) return null;

  const firstArg = node.arguments[0];
  if (!firstArg) return null;

  let path: string | null = null;
  if (ts.isStringLiteral(firstArg)) {
    path = firstArg.text;
  } else if (ts.isNoSubstitutionTemplateLiteral(firstArg)) {
    path = firstArg.text;
  }

  if (!path) return null;

  return { method: methodName.toUpperCase(), path };
}

/**
 * Try to find the handler name from the second argument of a route call.
 */
function getHandlerName(node: ts.CallExpression): string | null {
  const handler = node.arguments[1];
  if (!handler) return null;
  if (ts.isIdentifier(handler)) return handler.getText(handler.getSourceFile());
  if (ts.isPropertyAccessExpression(handler)) return handler.getText(handler.getSourceFile());
  if (ts.isFunctionExpression(handler) || ts.isArrowFunction(handler)) return "<inline>";
  return null;
}

/**
 * Truncate a value string for display.
 */
function truncate(s: string, maxLen: number = 80): string {
  const trimmed = s.replace(/\n/g, " ").trim();
  return trimmed.length > maxLen ? trimmed.slice(0, maxLen) + "..." : trimmed;
}

// ---------------------------------------------------------------------------
// Core extraction
// ---------------------------------------------------------------------------

function extractFromSourceFile(sourceFile: ts.SourceFile): ExtractionResult {
  const result: ExtractionResult = { functions: [], routes: [], constants: [] };
  const fileName = sourceFile.fileName;

  function visit(node: ts.Node) {
    // --- Exported function declarations ---
    if (ts.isFunctionDeclaration(node)) {
      const hasExport = node.modifiers?.some(
        (m) => m.kind === ts.SyntaxKind.ExportKeyword
      );
      if (hasExport && node.name) {
        result.functions.push({
          name: node.name.getText(sourceFile),
          kind: "function",
          params: node.parameters.map(paramToString),
          returnType: typeNodeToString(node.type),
          isAsync: node.modifiers?.some((m) => m.kind === ts.SyntaxKind.AsyncKeyword) ?? false,
          file: fileName,
        });
      }
    }

    // --- Exported variable statements (covers arrow functions + constants) ---
    if (ts.isVariableStatement(node)) {
      const hasExport = node.modifiers?.some(
        (m) => m.kind === ts.SyntaxKind.ExportKeyword
      );
      if (hasExport) {
        for (const decl of node.declarationList.declarations) {
          const varName = decl.name.getText(sourceFile);

          // Arrow function
          if (decl.initializer && ts.isArrowFunction(decl.initializer)) {
            const arrow = decl.initializer;
            const params: { name: string; type: string; optional: boolean }[] = [];
            for (const p of arrow.parameters) {
              params.push(paramToString(p));
            }
            let returnType = typeNodeToString(arrow.type);

            result.functions.push({
              name: varName,
              kind: "arrow",
              params,
              returnType,
              isAsync: arrow.modifiers?.some((m) => m.kind === ts.SyntaxKind.AsyncKeyword) ?? false,
              file: fileName,
            });
          }
          // Function expression assigned to const
          else if (decl.initializer && ts.isFunctionExpression(decl.initializer)) {
            const fn = decl.initializer;
            result.functions.push({
              name: varName,
              kind: "arrow",
              params: fn.parameters.map(paramToString),
              returnType: typeNodeToString(fn.type),
              isAsync: fn.modifiers?.some((m) => m.kind === ts.SyntaxKind.AsyncKeyword) ?? false,
              file: fileName,
            });
          }
          // Constant (non-function)
          else if (decl.initializer && !ts.isFunctionExpression(decl.initializer) && !ts.isArrowFunction(decl.initializer)) {
            const typeStr = typeNodeToString(decl.type);
            const valueSrc = decl.initializer.getText(sourceFile);
            result.constants.push({
              name: varName,
              type: typeStr,
              value: truncate(valueSrc),
              file: fileName,
            });
          }
        }
      }
    }

    // --- Route handlers: app.get("/path", handler) ---
    if (ts.isExpressionStatement(node) && ts.isCallExpression(node.expression)) {
      const route = isRouteCall(node.expression);
      if (route) {
        result.routes.push({
          method: route.method,
          path: route.path,
          handlerName: getHandlerName(node.expression),
          file: fileName,
        });
      }
    }

    // --- Also check call expressions in chains (e.g. app.get(...).post(...)) ---
    if (ts.isCallExpression(node)) {
      const route = isRouteCall(node);
      if (route) {
        const alreadyExists = result.routes.some(
          (r) => r.method === route!.method && r.path === route!.path
        );
        if (!alreadyExists) {
          result.routes.push({
            method: route.method,
            path: route.path,
            handlerName: getHandlerName(node),
            file: fileName,
          });
        }
      }
    }

    ts.forEachChild(node, visit);
  }

  ts.forEachChild(sourceFile, visit);
  return result;
}

// ---------------------------------------------------------------------------
// Program-level extraction (handles imports, compiler options)
// ---------------------------------------------------------------------------

function extractFile(filePath: string): ExtractionResult {
  const absolutePath = resolve(filePath);
  const source = readFileSync(absolutePath, "utf-8");

  const compilerOptions: ts.CompilerOptions = {
    target: ts.ScriptTarget.ESNext,
    module: ts.ModuleKind.ESNext,
    strict: true,
    esModuleInterop: true,
    skipLibCheck: true,
  };

  const sourceFile = ts.createSourceFile(
    absolutePath,
    source,
    ts.ScriptTarget.ESNext,
    true,
    ts.ScriptKind.TS
  );

  return extractFromSourceFile(sourceFile);
}

/**
 * Full program-level extraction that resolves imports and type-checks.
 * Use this when you need the TypeChecker to infer types.
 */
function extractWithProgram(filePaths: string[]): Map<string, ExtractionResult> {
  const compilerOptions: ts.CompilerOptions = {
    target: ts.ScriptTarget.ESNext,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.NodeNext,
    strict: true,
    esModuleInterop: true,
    skipLibCheck: true,
    allowSyntheticDefaultImports: true,
  };

  const program = ts.createProgram(filePaths, compilerOptions);
  const results = new Map<string, ExtractionResult>();

  for (const filePath of filePaths) {
    const sourceFile = program.getSourceFile(resolve(filePath));
    if (!sourceFile) continue;
    results.set(filePath, extractFromSourceFile(sourceFile));
  }

  return results;
}

// ---------------------------------------------------------------------------
// Pretty printing
// ---------------------------------------------------------------------------

function printResult(filePath: string, result: ExtractionResult) {
  const rel = filePath.replace(process.cwd() + "/", "");
  console.log(`\n${"=".repeat(70)}`);
  console.log(`FILE: ${rel}`);
  console.log(`${"=".repeat(70)}`);

  if (result.functions.length > 0) {
    console.log(`\n  FUNCTIONS (${result.functions.length}):`);
    for (const fn of result.functions) {
      const asyncPrefix = fn.isAsync ? "async " : "";
      const params = fn.params
        .map((p) => `${p.name}${p.optional ? "?" : ""}: ${p.type}`)
        .join(", ");
      console.log(
        `    [${fn.kind}] ${asyncPrefix}${fn.name}(${params}): ${fn.returnType}`
      );
    }
  }

  if (result.routes.length > 0) {
    console.log(`\n  ROUTES (${result.routes.length}):`);
    for (const route of result.routes) {
      const handler = route.handlerName ? ` -> ${route.handlerName}` : "";
      console.log(`    ${route.method} ${route.path}${handler}`);
    }
  }

  if (result.constants.length > 0) {
    console.log(`\n  CONSTANTS (${result.constants.length}):`);
    for (const c of result.constants) {
      const typeStr = c.type !== "unknown" ? `: ${c.type}` : "";
      console.log(`    ${c.name}${typeStr} = ${c.value}`);
    }
  }

  const total = result.functions.length + result.routes.length + result.constants.length;
  if (total === 0) {
    console.log("  (nothing extracted)");
  }
}

// ---------------------------------------------------------------------------
// Demo: run against this project's own source files
// ---------------------------------------------------------------------------

const DEMO_FILES = [
  "src/index.ts",
  "src/core/spec.ts",
  "src/core/config.ts",
  "src/commands/init.ts",
  "src/extractors/typescript.ts",
];

console.log("TypeScript Compiler API - Extractor Demo");
console.log("Extracting from project source files...\n");

for (const file of DEMO_FILES) {
  const fullPath = join(process.cwd(), file);
  try {
    const result = extractFile(fullPath);
    printResult(file, result);
  } catch (err) {
    console.error(`Failed to process ${file}:`, err);
  }
}

// ---------------------------------------------------------------------------
// Export for use as a library
// ---------------------------------------------------------------------------

export {
  extractFile,
  extractWithProgram,
  extractFromSourceFile,
  type ExtractionResult,
  type ExtractedFunction,
  type ExtractedRoute,
  type ExtractedConstant,
};
