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
  const result = node.childForFieldName("result");
  if (result) return result.text;
  const returns = node.children.filter((c) => c.type === "type_identifier" || c.type === "pointer_type" || c.type === "slice_type" || c.type === "parameter_list");
  if (returns.length > 0) {
    const lastReturnType = node.parent?.childForFieldName("result");
    return lastReturnType ? lastReturnType.text : "void";
  }
  return "void";
}

export async function parseGoInterfaces(content: string, filePath: string): Promise<InterfaceShape[]> {
  const shapes: InterfaceShape[] = [];
  const tree = await parseSource("go", content);

  function visit(node: TreeSitter.SyntaxNode) {
    if (node.type === "function_declaration") {
      const name = childFieldText(node, "name");
      if (name && name[0] === name[0].toUpperCase()) {
        const params = paramsText(node);
        const ret = node.childForFieldName("result");
        const returnType = ret ? ret.text : "void";
        shapes.push({ name, kind: "function", signature: `func ${name}(${params}) ${returnType}`, file: filePath, params, returnType });
      }
    }

    if (node.type === "method_declaration") {
      const name = childFieldText(node, "name");
      if (name && name[0] === name[0].toUpperCase()) {
        const params = paramsText(node);
        const ret = node.childForFieldName("result");
        const returnType = ret ? ret.text : "void";
        shapes.push({ name, kind: "function", signature: `func ${name}(${params}) ${returnType}`, file: filePath, params, returnType });
      }
    }

    if (node.type === "call_expression") {
      const funcName = childFieldText(node, "function");
      const funcMatch = funcName.match(/(?:r|router|group)\.(GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS)/i);
      if (funcMatch) {
        const args = node.childForFieldName("arguments");
        if (args && args.childCount >= 1) {
          const firstArg = args.children.find((c) => c.type === "interpreted_string_literal" || c.type === "raw_string_literal");
          if (firstArg) {
            const path = firstArg.text.slice(1, -1);
            const method = funcMatch[1].toUpperCase();
            shapes.push({ name: `${method} ${path}`, kind: "route", signature: `${method} ${path}`, file: filePath, httpMethod: method, path });
          }
        }
      }
    }

    if (node.type === "const_declaration") {
      const specs = node.children.filter((c) => c.type === "const_spec");
      for (const spec of specs) {
        const nameNode = spec.children.find((c) => c.type === "identifier");
        if (nameNode && nameNode.text[0] === nameNode.text[0].toUpperCase()) {
          const exprList = spec.children.find((c) => c.type === "expression_list");
          const valueNode = exprList ? exprList.children.find((c) => c.type !== "=") : spec.children.find((c) => c.type === "int_literal" || c.type === "interpreted_string_literal");
          const value = valueNode ? valueNode.text : "";
          if (value.length < 60) {
            shapes.push({ name: nameNode.text, kind: "constant", signature: `${nameNode.text} = ${value}`, file: filePath });
          }
        }
      }
    }

    if (node.type === "type_declaration") {
      const spec = node.childForFieldName("spec") || node.children.find((c) => c.type === "type_spec");
      if (spec) {
        const typeName = childFieldText(spec, "name");
        const typeDef = spec.childForFieldName("type");
        if (typeDef && typeDef.type === "interface_type") {
          for (const method of typeDef.children) {
            if (method.type === "method_elem") {
              const methodName = childFieldText(method, "name") || childFieldText(method, "field");
              if (methodName) {
                const paramLists = method.children.filter((c) => c.type === "parameter_list");
                const params = paramLists.length > 0 ? paramLists[0].text.slice(1, -1) : "";
                const returnType = paramLists.length > 1 ? paramLists[1].text : "void";
                shapes.push({ name: methodName, kind: "type", signature: `${methodName}(${params}) ${returnType}`, file: filePath, params, returnType });
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
