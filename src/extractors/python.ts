import type { InterfaceShape } from "./typescript.js";
import { parseSource } from "./treesitter.js";
import type * as TreeSitter from "web-tree-sitter";

function childFieldText(node: TreeSitter.SyntaxNode, fieldName: string): string {
  const child = node.childForFieldName(fieldName);
  return child ? child.text : "";
}

function paramsText(node: TreeSitter.SyntaxNode): string {
  const params = node.childForFieldName("parameters");
  if (!params) return "";
  return params.text.slice(1, -1);
}

function returnTypeText(node: TreeSitter.SyntaxNode): string {
  const ret = node.childForFieldName("return_type");
  return ret ? ret.text : "None";
}

function extractRouteFromDecorator(dec: TreeSitter.SyntaxNode): { method: string; path: string } | null {
  const decText = dec.text;
  const callNode = dec.children.find((c) => c.type === "call");
  if (!callNode) return null;

  const attrNode = callNode.children.find((c) => c.type === "attribute");
  if (!attrNode) return null;

  const methodNameNode = attrNode.children.find((c) => c.type === "identifier" && c.text !== "app" && c.text !== "router" && c.text !== "bp");
  if (!methodNameNode) return null;

  const methodName = methodNameNode.text.toLowerCase();
  const httpMethods = ["get", "post", "put", "delete", "patch", "head", "options"];
  if (!httpMethods.includes(methodName) && methodName !== "route") return null;

  const argList = callNode.children.find((c) => c.type === "argument_list");
  if (!argList) return null;

  const stringArg = argList.children.find((c) => c.type === "string");
  if (!stringArg) return null;

  const path = stringArg.text.slice(1, -1);
  const httpMethod = methodName === "route" ? "GET" : methodName.toUpperCase();

  const methodsArg = argList.children.find((c) => c.type === "keyword_argument" && c.text.startsWith("methods"));
  if (methodsArg) {
    const methodsMatch = methodsArg.text.match(/methods\s*=\s*\[\s*"(\w+)"/);
    if (methodsMatch) {
      return { method: methodsMatch[1].toUpperCase(), path };
    }
  }

  return { method: httpMethod, path };
}

export async function parsePyInterfaces(content: string, filePath: string): Promise<InterfaceShape[]> {
  const shapes: InterfaceShape[] = [];
  const tree = await parseSource("python", content);

  function visit(node: TreeSitter.SyntaxNode) {
    if (node.type === "function_definition") {
      const name = childFieldText(node, "name");
      const params = paramsText(node);
      const returnType = returnTypeText(node);
      const isAsync = node.childForFieldName("async") !== null || node.text.startsWith("async def");
      shapes.push({ name, kind: "function", signature: `def ${name}(${params}) -> ${returnType}`, file: filePath, params, returnType, isAsync });
    }

    if (node.type === "decorated_definition") {
      const decorators = node.children.filter((c) => c.type === "decorator");
      for (const dec of decorators) {
        const route = extractRouteFromDecorator(dec);
        if (route) {
          shapes.push({ name: `${route.method} ${route.path}`, kind: "route", signature: `${route.method} ${route.path}`, file: filePath, httpMethod: route.method, path: route.path });
        }
      }
    }

    if (node.type === "assignment" || node.type === "annotated_assignment") {
      const left = childFieldText(node, "left") || childFieldText(node, "name");
      const right = childFieldText(node, "right") || childFieldText(node, "value");
      if (left && left === left.toUpperCase() && right.length < 60) {
        shapes.push({ name: left, kind: "constant", signature: `${left} = ${right}`, file: filePath });
      }
    }

    for (const child of node.children) {
      visit(child);
    }
  }

  visit(tree.rootNode);
  return shapes;
}
