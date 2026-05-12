// @ts-nocheck
import type { InterfaceShape } from "./typescript.js";
import { parseSource } from "./treesitter.js";
import type * as TreeSitter from "web-tree-sitter";

function childFieldText(node: TreeSitter.SyntaxNode, fieldName: string): string {
  const child = node.childForFieldName(fieldName);
  return child ? child.text : "";
}

function findClassLevelRequestMapping(node: TreeSitter.SyntaxNode): string {
  for (const child of node.children) {
    if (child.type === "modifiers") {
      for (const mod of child.children) {
        if (mod.type === "annotation" && mod.text.includes("@RequestMapping")) {
          const pathMatch = mod.text.match(/@RequestMapping\s*\(\s*"([^"]+)"/);
          if (pathMatch) return pathMatch[1];
        }
      }
    }
  }
  return "";
}

function extractMethodDeclaration(member: TreeSitter.SyntaxNode, classBasePath: string, filePath: string): InterfaceShape[] {
  const shapes: InterfaceShape[] = [];
  const nameNode = member.children.find((c) => c.type === "identifier");
  if (!nameNode) return shapes;
  const methodName = nameNode.text;

  const typeNodes = member.children.filter((c) =>
    c.type === "type_identifier" || c.type === "generic_type" || c.type === "void_type" || c.type === "integral_type"
  );
  const returnType = typeNodes.length > 0 ? typeNodes[0].text : "void";

  const paramsNode = member.children.find((c) => c.type === "formal_parameters");
  const params = paramsNode ? paramsNode.text.slice(1, -1) : "";

  shapes.push({ name: methodName, kind: "function", signature: `${returnType} ${methodName}(${params})`, file: filePath, params, returnType });

  const modifiers = member.children.find((c) => c.type === "modifiers");
  if (modifiers) {
    for (const mod of modifiers.children) {
      if (mod.type === "annotation" || mod.type === "marker_annotation") {
        const routeMatch = mod.text.match(/@(Get|Post|Put|Delete|Patch)Mapping(?:\s*\(\s*"([^"]*)"\s*\))?\s*$/);
        if (routeMatch) {
          const method = routeMatch[1].toUpperCase();
          const methodPath = routeMatch[2] ?? "";
          const fullPath = methodPath ? classBasePath.replace(/\/$/, "") + "/" + methodPath.replace(/^\//, "") : classBasePath;
          shapes.push({ name: `${method} ${fullPath}`, kind: "route", signature: `${method} ${fullPath}`, file: filePath, httpMethod: method, path: fullPath });
        }
      }
    }
  }

  return shapes;
}

export async function parseJavaInterfaces(content: string, filePath: string): Promise<InterfaceShape[]> {
  const shapes: InterfaceShape[] = [];
  const tree = await parseSource("java", content);

  function visit(node: TreeSitter.SyntaxNode) {
    if (node.type === "class_declaration" || node.type === "interface_declaration") {
      const classBasePath = findClassLevelRequestMapping(node);

      const body = node.children.find((c) => c.type === "class_body" || c.type === "interface_body");
      if (body) {
        for (const member of body.children) {
          if (member.type === "method_declaration") {
            shapes.push(...extractMethodDeclaration(member, classBasePath, filePath));
          }

          if (member.type === "field_declaration") {
            const modifiers = member.children.find((c) => c.type === "modifiers");
            const hasStatic = modifiers?.children.some((c) => c.text === "static");
            const hasFinal = modifiers?.children.some((c) => c.text === "final");
            if (hasStatic && hasFinal) {
              const declarators = member.children.filter((c) => c.type === "variable_declarator");
              for (const decl of declarators) {
                const constName = childFieldText(decl, "name");
                const value = childFieldText(decl, "value");
                if (constName && value.length < 60) {
                  shapes.push({ name: constName, kind: "constant", signature: `${constName} = ${value}`, file: filePath });
                }
              }
            }
          }
        }
      }
    }

    for (const child of node.children) {
      visit(child);
    }
  }

  visit(tree.rootNode);
  return shapes;
}
