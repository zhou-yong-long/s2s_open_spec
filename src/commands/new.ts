import type { Argv, CommandModule } from "yargs";
import { existsSync } from "fs";
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

/** Supported `sdd new --type` values (single source for yargs + template map). */
export const NEW_SPEC_TYPES = [
  "feature-spec",
  "feature-spec-pm",
  "qa-from-spec",
  "design-doc",
  "adr",
] as const;
export type NewSpecType = (typeof NEW_SPEC_TYPES)[number];

interface NewArgs {
  name: string;
  type: NewSpecType;
  domain?: string;
}

const TYPE_TEMPLATE: Record<NewSpecType, string> = {
  "feature-spec": "feature-spec.md",
  "feature-spec-pm": "feature-spec-pm.md",
  "qa-from-spec": "qa-from-spec.md",
  "design-doc": "design-doc.md",
  adr: "adr.md",
};

/** Lowercase slug for filenames; empty if nothing alphanumeric remains. */
export function sanitizeSpecSlug(raw: string): string {
  return raw.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "").replace(/-+/g, "-").replace(/^-|-$/g, "");
}

/** Basename under specs/active/ (and optional domain segment). */
export function outputFilenameForType(type: NewSpecType, date: string, slug: string): string {
  switch (type) {
    case "feature-spec-pm":
      return `${date}-pm-${slug}.md`;
    case "qa-from-spec":
      return `${date}-qa-${slug}.md`;
    default:
      return `${date}-${slug}.md`;
  }
}

export const newCommand: CommandModule<{}, NewArgs> = {
  command: "new <name>",
  describe: "Create a new spec, PM spec, QA checklist, design doc, or ADR from a template",
  builder: (yargs: Argv<{}>): Argv<NewArgs> =>
    yargs
      .positional("name", {
        type: "string",
        describe: 'Feature title; appears as {{TITLE}} in the file. Quote for spaces (e.g. new "My Feature"). Filename uses a slug (letters, digits, hyphens).',
        demandOption: true,
      } as const)
      .option("type", {
        type: "string",
        choices: [...NEW_SPEC_TYPES],
        default: "feature-spec" satisfies NewSpecType,
        describe:
          "feature-spec (default) | feature-spec-pm | qa-from-spec | design-doc | adr",
      } as const)
      .option("domain", { type: "string", describe: "Domain folder for domain/team modes" } as const) as unknown as Argv<NewArgs>,
  handler: (argv) => {
    const cwd = process.cwd();
    const config = readConfig(cwd);
    const slug = sanitizeSpecSlug(argv.name!);
    if (!slug) {
      console.error(chalk.red("✘ Name must contain at least one letter or digit after normalization."));
      process.exit(1);
    }

    const date = new Date().toISOString().slice(0, 10);
    const filename = outputFilenameForType(argv.type!, date, slug);

    let activeDir = join(cwd, config.paths.active);
    if ((config.mode === "domain" || config.mode === "team") && argv.domain) {
      activeDir = join(activeDir, argv.domain);
    }
    mkdirSync(activeDir, { recursive: true });

    const templateName = TYPE_TEMPLATE[argv.type!];
    const templatePath = join(templateDir, templateName);
    if (!existsSync(templatePath)) {
      console.error(chalk.red(`✘ Template not found: ${templatePath}`));
      process.exit(1);
    }

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
    if (existsSync(specPath)) {
      console.error(chalk.red(`✘ Spec already exists: ${specPath}`));
      console.error(chalk.yellow("Use a different title, or amend the existing spec with: sdd amend <spec-file>"));
      process.exit(1);
    }
    writeFileSync(specPath, content);
    console.log(chalk.green(`Created: ${specPath}`));

    const editor = process.env.EDITOR || process.env.VISUAL;
    if (editor) {
      try {
        execSync(`${editor} "${specPath}"`, { cwd, stdio: "inherit" });
      } catch {
        /* best-effort */
      }
    }
  },
};
