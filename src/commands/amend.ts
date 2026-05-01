import type { CommandModule } from "yargs";
import { parseSpec, appendChangelog, updateFrontmatter } from "../core/spec.js";
import { getDiffStat, getHeadCommit, getCurrentUser } from "../core/git.js";
import { writeFileSync, readFileSync, rmSync } from "fs";
import { join } from "path";
import { execSync } from "child_process";
import chalk from "chalk";

interface AmendArgs {
  spec: string;
  message?: string;
}

export const amendCommand: CommandModule<{}, AmendArgs> = {
  command: "amend <spec>",
  describe: "Record a minor change to a spec",
  builder: (yargs) =>
    yargs
      .positional("spec", { type: "string", describe: "Path to spec file", demandOption: true })
      .option("message", { type: "string", alias: "m", describe: "Change description" }),
  handler: (argv) => {
    const cwd = process.cwd();
    const specPath = join(cwd, argv.spec!);
    const spec = parseSpec(specPath);
    const fm = spec.frontmatter;

    if (fm.pinned_commit) {
      const diffStat = getDiffStat(fm.pinned_commit, fm.linked_files, cwd);
      if (diffStat) {
        console.log(chalk.gray("Changes since last baseline:\n" + diffStat));
      } else {
        console.log(chalk.gray("No code changes detected since pinned commit."));
      }
    } else {
      console.log(chalk.gray("No pinned commit. Use `sdd review` to set a baseline."));
    }

    let change = argv.message;
    if (!change) {
      const editor = process.env.EDITOR || process.env.VISUAL || "vim";
      const tmpFile = join(cwd, ".sdd", ".amend-msg");
      writeFileSync(tmpFile, "# Describe the change:\n");
      try {
        execSync(`${editor} "${tmpFile}"`, { cwd, stdio: "inherit" });
        change = readFileSync(tmpFile, "utf-8").split("\n").filter((l) => !l.startsWith("#")).join("\n").trim();
      } catch { /* editor failed */ }
      try { rmSync(tmpFile); } catch { /* cleanup */ }
    }

    if (!change) {
      console.log(chalk.yellow("No change description provided. Aborting."));
      return;
    }

    const date = new Date().toISOString().slice(0, 10);
    const author = getCurrentUser(cwd) || fm.author || "unknown";
    appendChangelog(specPath, { date, change, author });

    const head = getHeadCommit(cwd);
    if (head) updateFrontmatter(specPath, { pinned_commit: head });

    console.log(chalk.green(`Changelog updated: ${change}`));
  },
};
