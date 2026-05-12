// @ts-nocheck
import ts from "typescript";

export interface InterfaceShape {
  name: string;
  kind: "function" | "route" | "type" | "constant";
  signature: string;
  file: string;
  params?: string;
  returnType?: string;
  isAsync?: boolean;
  httpMethod?: string;
  path?: string;
}

function typeNodeToString(node: ts.TypeNode | undefined, sf: ts.SourceFile): string {
  if (!node) return "void";
  return node.getFullText(sf).trim();
}

function paramsToString(params: ts.NodeArray<ts.ParameterDeclaration>, sf: ts.SourceFile): string {
  return params
    .map((p) => {
      const name = p.name.getText(sf);
      const type = p.type ? `: ${typeNodeToString(p.type, sf)}` : "";
      return `${name}${type}`;
    })
    .join(", ");
}

function getRouteInfo(node: ts.CallExpression, sf: ts.SourceFile): { method: string; path: string } | null {
  const expr = node.expression;
  if (!ts.isPropertyAccessExpression(expr)) return null;
  const method = expr.name.getText(sf).toLowerCase();
  if (!["get", "post", "put", "delete", "patch", "head", "options"].includes(method)) return null;
  const pathArg = node.arguments[0];
  if (!ts.isStringLiteral(pathArg) && !ts.isNoSubstitutionTemplateLiteral(pathArg)) return null;
  return { method: method.toUpperCase(), path: pathArg.text };
}

export function parseTsInterfaces(content: string, filePath: string): InterfaceShape[] {
  const shapes: InterfaceShape[] = [];
  const sf = ts.createSourceFile(filePath, content, ts.ScriptTarget.ESNext, true, ts.ScriptKind.TS);

  function visit(node: ts.Node) {
    if (ts.isFunctionDeclaration(node)) {
      const hasExport = node.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
      const isAsync = node.modifiers?.some((m) => m.kind === ts.SyntaxKind.AsyncKeyword);
      if (hasExport && node.name) {
        const name = node.name.getText(sf);
        const params = paramsToString(node.parameters, sf);
        const returnType = typeNodeToString(node.type, sf);
        shapes.push({ name, kind: "function", signature: `${name}(${params}): ${returnType}`, file: filePath, params, returnType, isAsync });
      }
    }

    if (ts.isVariableStatement(node)) {
      const hasExport = node.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
      if (!hasExport) {
        ts.forEachChild(node, visit);
        return;
      }

      for (const decl of node.declarationList.declarations) {
        if (ts.isArrowFunction(decl.initializer) || ts.isFunctionExpression(decl.initializer)) {
          const name = decl.name.getText(sf);
          const isAsync = decl.initializer.modifiers?.some((m) => m.kind === ts.SyntaxKind.AsyncKeyword);
          const params = paramsToString(decl.initializer.parameters, sf);
          const returnType = typeNodeToString(decl.initializer.type, sf);
          shapes.push({ name, kind: "function", signature: `${name}(${params}): ${returnType}`, file: filePath, params, returnType, isAsync });
        } else if (decl.initializer && !ts.isFunctionLike(decl.initializer)) {
          const name = decl.name.getText(sf);
          const value = decl.initializer.getText(sf);
          if (value.length < 60) {
            shapes.push({ name, kind: "constant", signature: `${name} = ${value}`, file: filePath });
          }
        }
      }
    }

    if (ts.isCallExpression(node)) {
      const route = getRouteInfo(node, sf);
      if (route) {
        shapes.push({ name: `${route.method} ${route.path}`, kind: "route", signature: `${route.method} ${route.path}`, file: filePath, httpMethod: route.method, path: route.path });
      }
    }

    ts.forEachChild(node, visit);
  }

  ts.forEachChild(sf, visit);
  return shapes;
}
