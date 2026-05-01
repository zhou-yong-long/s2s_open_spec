import type { CommandModule } from "yargs";
import { parseSpec } from "../core/spec.js";
import { readConfig } from "../core/config.js";
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import chalk from "chalk";
import type { InterfaceShape } from "../extractors/typescript.js";

export function compareInterfaces(
  specShapes: InterfaceShape[],
  codeShapes: InterfaceShape[]
): { missing: string[]; extra: string[] }[] {
  const specNames = new Set(specShapes.map((s) => s.name));
  const codeNames = new Set(codeShapes.map((s) => s.name));
  const missing = [...specNames].filter((n) => !codeNames.has(n));
  const extra = [...codeNames].filter((n) => !specNames.has(n));
  return [{ missing, extra }];
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
        codeShapes.push(...parsePyInterfaces(content, fullPath));
      }
    }

    const results = compareInterfaces(specShapes, codeShapes);
    if (results[0].missing.length === 0) {
      console.log(chalk.green("Spec interfaces match code."));
    } else {
      console.log(chalk.red("Mismatches detected:"));
      if (results[0].missing.length > 0) {
        console.log(chalk.yellow(`  In spec but not in code: ${results[0].missing.join(", ")}`));
      }
      if (results[0].extra.length > 0) {
        console.log(chalk.yellow(`  In code but not in spec: ${results[0].extra.join(", ")}`));
      }
    }
  },
};

export default {
  name: "diff",
  description: "Detect spec vs code mismatches",
  commands: { diff: diffCommand },
};
