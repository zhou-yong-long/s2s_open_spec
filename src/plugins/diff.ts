import type { CommandModule } from "yargs";
import { parseSpec } from "../core/spec.js";
import { readConfig } from "../core/config.js";
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import chalk from "chalk";
export type { InterfaceShape } from "../extractors/typescript.js";
import type { InterfaceShape } from "../extractors/typescript.js";

export interface DiffResult {
  missing: { name: string; signature?: string }[];
  extra: { name: string; signature?: string }[];
  signatureMismatch: { name: string; spec: string; code: string }[];
}

export function compareInterfaces(specShapes: InterfaceShape[], codeShapes: InterfaceShape[]): DiffResult {
  const specMap = new Map(specShapes.map((s) => [s.name, s]));
  const codeMap = new Map(codeShapes.map((s) => [s.name, s]));

  const missing: { name: string; signature?: string }[] = [];
  const extra: { name: string; signature?: string }[] = [];
  const signatureMismatch: { name: string; spec: string; code: string }[] = [];

  for (const [name, specShape] of specMap) {
    const codeShape = codeMap.get(name);
    if (!codeShape) {
      missing.push({ name, signature: specShape.signature });
    } else if (specShape.params && codeShape.params && specShape.params !== codeShape.params) {
      signatureMismatch.push({ name, spec: specShape.signature, code: codeShape.signature });
    } else if (specShape.returnType && codeShape.returnType && specShape.returnType !== codeShape.returnType) {
      signatureMismatch.push({ name, spec: specShape.signature, code: codeShape.signature });
    }
  }

  for (const [name, codeShape] of codeMap) {
    if (!specMap.has(name)) {
      extra.push({ name, signature: codeShape.signature });
    }
  }

  return { missing, extra, signatureMismatch };
}

function parseSpecInterfaces(body: string): InterfaceShape[] {
  const shapes: InterfaceShape[] = [];
  const section = body.match(/### Interfaces\n([\s\S]*?)(?:\n###|\n##|$)/);
  if (!section) return shapes;
  const lines = section[1].split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("- ")) {
      const content = trimmed.slice(2);
      const name = content.split(/[→:]/)[0].trim();
      if (name) {
        shapes.push({ name, kind: "route", signature: content, file: "spec" });
      }
    }
  }
  return shapes;
}

const diffCommand: CommandModule = {
  command: "diff <spec>",
  describe: "Check spec interfaces against code",
  builder: (yargs) => yargs.positional("spec", { type: "string", demandOption: true }),
  handler: async (argv) => {
    const cwd = process.cwd();
    const specPath = join(cwd, argv.spec as string);
    const spec = parseSpec(specPath);
    const specShapes = parseSpecInterfaces(spec.body);

    if (specShapes.length === 0) {
      console.log(chalk.yellow("No interfaces found in spec."));
      return;
    }

    const codeShapes: InterfaceShape[] = [];
    for (const relPath of spec.frontmatter.linked_files) {
      const fullPath = join(cwd, relPath);
      if (!existsSync(fullPath)) {
        console.log(chalk.gray(`  Skipping missing file: ${relPath}`));
        continue;
      }
      const content = readFileSync(fullPath, "utf-8");
      const ext = relPath.slice(relPath.lastIndexOf("."));
      if (ext === ".ts" || ext === ".tsx") {
        const { parseTsInterfaces } = await import("../extractors/typescript.js");
        codeShapes.push(...parseTsInterfaces(content, fullPath));
      } else if (ext === ".py") {
        const { parsePyInterfaces } = await import("../extractors/python.js");
        codeShapes.push(...(await parsePyInterfaces(content, fullPath)));
      } else if (ext === ".java") {
        const { parseJavaInterfaces } = await import("../extractors/java.js");
        codeShapes.push(...(await parseJavaInterfaces(content, fullPath)));
      } else if (ext === ".go") {
        const { parseGoInterfaces } = await import("../extractors/go.js");
        codeShapes.push(...(await parseGoInterfaces(content, fullPath)));
      }
    }

    const results = compareInterfaces(specShapes, codeShapes);
    const hasIssues = results.missing.length > 0 || results.extra.length > 0 || results.signatureMismatch.length > 0;

    if (!hasIssues) {
      console.log(chalk.green("Spec interfaces match code."));
    } else {
      console.log(chalk.red("Mismatches detected:"));
      if (results.missing.length > 0) {
        console.log(chalk.yellow(`  In spec but not in code:`));
        for (const m of results.missing) {
          console.log(chalk.yellow(`    - ${m.name}${m.signature ? ` (${m.signature})` : ""}`));
        }
      }
      if (results.extra.length > 0) {
        console.log(chalk.yellow(`  In code but not in spec:`));
        for (const e of results.extra) {
          console.log(chalk.yellow(`    + ${e.name}${e.signature ? ` (${e.signature})` : ""}`));
        }
      }
      if (results.signatureMismatch.length > 0) {
        console.log(chalk.yellow(`  Signature mismatches:`));
        for (const m of results.signatureMismatch) {
          console.log(chalk.yellow(`    ~ ${m.name}: spec="${m.spec}" code="${m.code}"`));
        }
      }
    }
  },
};

export default {
  name: "diff",
  description: "Detect spec vs code mismatches",
  commands: { diff: diffCommand },
};
