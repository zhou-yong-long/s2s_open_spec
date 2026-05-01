import type { CommandModule } from "yargs";
import { existsSync, readdirSync } from "fs";
import { join } from "path";
import { copyScaffold } from "../core/scaffold.js";
import { writeConfig, readConfig, type Mode, type Template } from "../core/config.js";
import { gitInit, getCurrentUser } from "../core/git.js";
import chalk from "chalk";

interface InitArgs {
  mode?: Mode;
  template?: Template;
  force?: boolean;
}

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
    if (!existsSync(join(cwd, ".git"))) gitInit(cwd);
    console.log(chalk.green(`SDD project initialized. Mode: ${config.mode}, Template: ${config.template}`));
  },
};
