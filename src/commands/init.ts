import type { CommandModule } from "yargs";
import { existsSync, readdirSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import yaml from "js-yaml";
import { copyScaffold } from "../core/scaffold.js";
import { writeConfig, readConfig, type Mode, type Template } from "../core/config.js";
import { gitInit, getCurrentUser } from "../core/git.js";
import chalk from "chalk";

interface InitArgs {
  mode?: Mode;
  template?: Template;
  force?: boolean;
}

const DEFAULT_LINKS_DATA = {
  version: 1,
  linkTypes: [
    { name: "parent", directed: true, description: "Parent-child hierarchy" },
    { name: "child", directed: true, description: "Auto-generated reverse of parent" },
    { name: "blocks", directed: true, description: "Source must be completed before target" },
    { name: "blocked-by", directed: true, description: "Auto-generated reverse of blocks" },
    { name: "relates", directed: false, description: "Loose association between specs" },
    { name: "duplicates", directed: false, description: "Target supersedes source" },
  ],
  links: [],
};

export const initCommand: CommandModule<{}, InitArgs> = {
  command: "init",
  describe: "Scaffold an SDD project in the current directory",
  builder: (yargs) =>
    yargs
      .option("mode", { type: "string", choices: ["flat", "domain", "team"] as const })
      .option("template", { type: "string", choices: ["minimal", "default", "full"] as const })
      .option("force", { type: "boolean", describe: "Skip non-empty directory check" }),
  handler: (argv) => {
    const cwd = process.cwd();
    const existing = existsSync(cwd) ? readdirSync(cwd).filter((f) => f !== ".git") : [];
    if (existing.length > 0 && !argv.force) {
      console.error(chalk.red(`Directory not empty (${existing.length} items). Use --force to override.`));
      process.exit(1);
    }
    const author = getCurrentUser(cwd) || "unknown";
    const date = new Date().toISOString().slice(0, 10);
    copyScaffold(cwd, { author, date });
    const config = readConfig(cwd);
    if (argv.mode) config.mode = argv.mode;
    if (argv.template) config.template = argv.template;
    writeConfig(cwd, config);

    // Create initial links.yaml
    const sddDir = join(cwd, ".sdd");
    mkdirSync(sddDir, { recursive: true });
    const linksPath = join(sddDir, "links.yaml");
    if (!existsSync(linksPath)) {
      writeFileSync(linksPath, yaml.dump(DEFAULT_LINKS_DATA, { indent: 2, lineWidth: 120 }));
    }

    if (!existsSync(join(cwd, ".git"))) gitInit(cwd);
    console.log(chalk.green(`SDD project initialized. Mode: ${config.mode}, Template: ${config.template}`));
  },
};
