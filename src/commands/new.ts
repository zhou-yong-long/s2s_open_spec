import type { Argv, CommandModule } from "yargs";
import { readConfig } from "../core/config.js";
import { renderTemplate } from "../core/scaffold.js";
import { getCurrentUser } from "../core/git.js";
import { mkdirSync, writeFileSync, readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";
import chalk from "chalk";

const __dirname = dirname(fileURLToPath(import.meta.url));
const templateDir = join(__dirname, "..", "..", "scaffold", "templates");

interface NewArgs {
  name: string;
  type: "feature-spec" | "design-doc" | "adr";
  domain?: string;
}

const TYPE_TEMPLATE: Record<string, string> = {
  "feature-spec": "feature-spec.md",
  "design-doc": "design-doc.md",
  adr: "adr.md",
};

export const newCommand: CommandModule<{}, NewArgs> = {
  command: "new <name>",
  describe: "Create a new spec",
  builder: (yargs: Argv<{}>): Argv<NewArgs> =>
    yargs
      .positional("name", { type: "string", describe: "Spec name", demandOption: true } as const)
      .option("type", { type: "string", choices: ["feature-spec", "design-doc", "adr"] as const, default: "feature-spec" as const })
      .option("domain", { type: "string", describe: "Domain for domain/team modes" } as const) as unknown as Argv<NewArgs>,
  handler: (argv) => {
    const cwd = process.cwd();
    const config = readConfig(cwd);
    const name = argv.name!.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
    const date = new Date().toISOString().slice(0, 10);
    const filename = `${date}-${name}.md`;

    let activeDir = join(cwd, config.paths.active);
    if ((config.mode === "domain" || config.mode === "team") && argv.domain) {
      activeDir = join(activeDir, argv.domain);
    }
    mkdirSync(activeDir, { recursive: true });

    const templateName = TYPE_TEMPLATE[argv.type!] ?? TYPE_TEMPLATE["feature-spec"];
    const templatePath = join(templateDir, templateName);
    const template = readFileSync(templatePath, "utf-8");
    const author = getCurrentUser(cwd) || "unknown";

    const content = renderTemplate(template, {
      AUTHOR: author,
      DATE: date,
      TITLE: argv.name!,
      DOMAIN: argv.domain ?? "null",
      NUMBER: String(Math.floor(Math.random() * 1000)).padStart(3, "0"),
    });

    const specPath = join(activeDir, filename);
    writeFileSync(specPath, content);
    console.log(chalk.green(`Created: ${specPath}`));

    const editor = process.env.EDITOR || process.env.VISUAL;
    if (editor) {
      try { execSync(`${editor} "${specPath}"`, { cwd, stdio: "inherit" }); } catch { /* best-effort */ }
    }
  },
};
