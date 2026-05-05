import type { CommandModule } from "yargs";
import { parseSpec, updateFrontmatter, appendChangelog, appendReviewLog, appendReviewThread, resolveThread, getOpenThreads, type SpecStatus } from "../core/spec.js";
import { getHeadCommit, getCurrentUser } from "../core/git.js";
import { readConfig } from "../core/config.js";
import { existsSync, renameSync, mkdirSync, readFileSync } from "fs";
import { join } from "path";
import chalk from "chalk";

const reviewCommand: CommandModule = {
  command: "review <spec>",
  describe: "Review a spec (self or teammate sign-off)",
  builder: (yargs) =>
    yargs
      .positional("spec", { type: "string", demandOption: true })
      .option("self", { type: "boolean", describe: "Self-review (solo mode)" })
      .option("decision", { type: "string", choices: ["approved", "changes-requested"] as const })
      .option("notes", { type: "string", describe: "Review comment or note" })
      .option("section", { type: "string", describe: "Spec section the comment targets (e.g. Interfaces, Edge Cases)" }),
  handler: (argv) => {
    const cwd = process.cwd();
    const specPath = join(cwd, argv.spec as string);
    const spec = parseSpec(specPath);
    const reviewer = getCurrentUser(cwd);

    // Self-review: just mark ready
    if (argv.self) {
      updateFrontmatter(specPath, { status: "ready" });
      console.log(chalk.green(`Self-reviewed: ${specPath} → ready`));
      return;
    }

    const notes = argv.notes as string | undefined;
    const section = argv.section as string | undefined;
    const decision = argv.decision as string | undefined;

    // Mode 1: Leave review comment (notes provided, no decision)
    if (notes && !decision) {
      const today = new Date().toISOString().slice(0, 10);
      appendReviewThread(specPath, {
        title: notes.length > 50 ? notes.slice(0, 50) + "..." : notes,
        reviewer,
        created: today,
        section: section || "General",
        comment: notes,
      });
      console.log(chalk.cyan(`Comment added to ${specPath}`));
      console.log(chalk.gray(`  Thread: ${notes}`));
      return;
    }

    // Mode 2: Decision with optional notes
    if (decision) {
      // Gate check for approved
      if (decision === "approved") {
        const openThreads = getOpenThreads(specPath);
        if (openThreads.length > 0) {
          console.log(chalk.red(`✘ Cannot approve: ${openThreads.length} unresolved thread(s)`));
          for (const t of openThreads) {
            console.log(chalk.yellow(`  → [ ] ${t.title} (${t.section})`));
          }
          console.log(chalk.gray(`  Run 'sdd threads ${argv.spec}' to see details.`));
          process.exit(1);
        }
      }

      // Write Review Log entry
      const today = new Date().toISOString().slice(0, 10);
      appendReviewLog(specPath, {
        date: today,
        reviewer,
        decision,
        notes: notes || "",
      });

      // Update status
      const newStatus: SpecStatus = decision === "approved" ? "approved" : "draft";
      updateFrontmatter(specPath, {
        status: newStatus,
        pinned_commit: decision === "approved" ? getHeadCommit(cwd) || null : spec.frontmatter.pinned_commit,
      });

      console.log(chalk.green(`Reviewed: ${specPath} → ${newStatus}`));
      if (notes) {
        console.log(chalk.gray(`  Notes: ${notes}`));
      }
      return;
    }

    // Mode 3: Notes only, no decision (already handled above)
    // If no notes and no decision, default to changes-requested
    console.log(chalk.yellow("No decision specified. Use --decision approved|changes-requested or --self"));
  },
};

const threadsCommand: CommandModule = {
  command: "threads <spec>",
  describe: "List review threads for a spec",
  builder: (yargs) => yargs.positional("spec", { type: "string", demandOption: true }),
  handler: (argv) => {
    const cwd = process.cwd();
    const specPath = join(cwd, argv.spec as string);
    const spec = parseSpec(specPath);

    if (spec.reviewThreads.length === 0) {
      console.log(chalk.gray("No review threads."));
      return;
    }

    for (const t of spec.reviewThreads) {
      const marker = t.resolved ? chalk.green("[x]") : chalk.red("[ ]");
      const idx = chalk.dim(`#${t.index}`);
      console.log(`${marker} ${idx} ${chalk.bold(t.title)}`);
      console.log(chalk.dim(`   ${t.reviewer} | ${t.created} | ${t.section}`));
      console.log(`   > ${t.comment}`);
      if (t.response) {
        console.log(chalk.green(`   ✓ Response (${t.responseDate}): ${t.response}`));
      }
      console.log();
    }
  },
};

const resolveCommand: CommandModule = {
  command: "resolve <spec> <index>",
  describe: "Resolve a review thread by index",
  builder: (yargs) =>
    yargs
      .positional("spec", { type: "string", demandOption: true })
      .positional("index", { type: "number", demandOption: true })
      .option("response", { type: "string", alias: "m", describe: "Response message" }),
  handler: (argv) => {
    const cwd = process.cwd();
    const specPath = join(cwd, argv.spec as string);
    const threadIndex = (argv.index as number) - 1; // Zero-indexed for internal use
    const response = (argv.response as string) || "Resolved.";

    // Get the thread title before resolving for display
    const openThreads = getOpenThreads(specPath);
    if (threadIndex < 0 || threadIndex >= openThreads.length) {
      console.log(chalk.red(`Invalid thread index: ${argv.index}. Open threads: ${openThreads.length}`));
      process.exit(1);
    }

    const thread = openThreads[threadIndex];
    const success = resolveThread(specPath, threadIndex, response);

    if (success) {
      console.log(chalk.green(`✓ Resolved thread #${argv.index}: ${thread.title}`));
      // Append to changelog
      appendChangelog(specPath, {
        date: new Date().toISOString().slice(0, 10),
        change: `Resolved review: ${thread.title}`,
        author: getCurrentUser(cwd),
      });
    } else {
      console.log(chalk.red("Failed to resolve thread."));
      process.exit(1);
    }
  },
};

const completeCommand: CommandModule = {
  command: "complete <spec>",
  describe: "Mark a spec as complete and move to completed/",
  builder: (yargs) => yargs.positional("spec", { type: "string", demandOption: true }),
  handler: (argv) => {
    const cwd = process.cwd();
    const specPath = join(cwd, argv.spec as string);

    // Gate check: warn if open threads
    const openThreads = getOpenThreads(specPath);
    if (openThreads.length > 0) {
      console.log(chalk.yellow(`⚠ Warning: ${openThreads.length} unresolved review thread(s)`));
      for (const t of openThreads) {
        console.log(chalk.yellow(`  → [ ] ${t.title}`));
      }
    }

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
  description: "Review, comment, resolve threads, complete, and archive specs",
  commands: {
    review: reviewCommand,
    threads: threadsCommand,
    resolve: resolveCommand,
    complete: completeCommand,
    archive: archiveCommand,
  },
};
