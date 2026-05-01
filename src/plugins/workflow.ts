import type { CommandModule } from "yargs";
import { parseSpec, updateFrontmatter, type SpecStatus } from "../core/spec.js";
import { getHeadCommit, getCurrentUser } from "../core/git.js";
import { readConfig } from "../core/config.js";
import { existsSync, renameSync, mkdirSync } from "fs";
import { join } from "path";
import chalk from "chalk";

const reviewCommand: CommandModule = {
  command: "review <spec>",
  describe: "Review a spec (self or teammate sign-off)",
  builder: (yargs) =>
    yargs
      .positional("spec", { type: "string", demandOption: true })
      .option("self", { type: "boolean", describe: "Self-review (solo mode)" })
      .option("decision", { type: "string", choices: ["approved", "changes-requested"] as const, default: "approved" }),
  handler: (argv) => {
    const cwd = process.cwd();
    const specPath = join(cwd, argv.spec as string);
    const spec = parseSpec(specPath);

    if (argv.self) {
      updateFrontmatter(specPath, { status: "ready" });
      console.log(chalk.green(`Self-reviewed: ${specPath} → ready`));
      return;
    }

    const decision = (argv.decision as string) === "approved" ? "approved" : "changes-requested";
    const newStatus: SpecStatus = decision === "approved" ? "approved" : "draft";
    updateFrontmatter(specPath, {
      status: newStatus,
      pinned_commit: decision === "approved" ? getHeadCommit(cwd) || null : spec.frontmatter.pinned_commit,
    });
    console.log(chalk.green(`Reviewed: ${specPath} → ${newStatus}`));
  },
};

const completeCommand: CommandModule = {
  command: "complete <spec>",
  describe: "Mark a spec as complete and move to completed/",
  builder: (yargs) => yargs.positional("spec", { type: "string", demandOption: true }),
  handler: (argv) => {
    const cwd = process.cwd();
    const specPath = join(cwd, argv.spec as string);
    updateFrontmatter(specPath, { status: "complete" });
    const config = readConfig(cwd);
    const dest = join(cwd, config.paths.completed);
    mkdirSync(dest, { recursive: true });
    const newPath = join(dest, specPath.split("/").pop()!);
    renameSync(specPath, newPath);
    console.log(chalk.green(`Complete: ${newPath}`));
  },
};

const archiveCommand: CommandModule = {
  command: "archive <spec>",
  describe: "Archive a spec (rejected or superseded)",
  builder: (yargs) => yargs.positional("spec", { type: "string", demandOption: true }),
  handler: (argv) => {
    const cwd = process.cwd();
    const specPath = join(cwd, argv.spec as string);
    updateFrontmatter(specPath, { status: "archived" });
    const config = readConfig(cwd);
    const dest = join(cwd, config.paths.archived);
    mkdirSync(dest, { recursive: true });
    const newPath = join(dest, specPath.split("/").pop()!);
    renameSync(specPath, newPath);
    console.log(chalk.yellow(`Archived: ${newPath}`));
  },
};

export default {
  name: "workflow",
  description: "Review, complete, and archive specs",
  commands: { review: reviewCommand, complete: completeCommand, archive: archiveCommand },
};
