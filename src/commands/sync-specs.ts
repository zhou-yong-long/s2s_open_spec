import type { CommandModule } from "yargs";
import { join } from "path";
import chalk from "chalk";
import { buildIndex, writeIndex, readIndex, shouldDebounce } from "../core/hive-index.js";

interface SyncSpecsArgs {
  force?: boolean;
}

export const syncSpecsCommand: CommandModule<{}, SyncSpecsArgs> = {
  command: "sync-specs",
  describe: "Scan project structure and generate Hive Mind spec index",
  builder: (yargs) =>
    yargs.option("force", {
      type: "boolean",
      describe: "Force rescan even if index is recent",
    }),
  handler: (argv) => {
    const cwd = process.cwd();
    const indexPath = join(cwd, ".hivemind", "specs.json");

    try {
      if (!argv.force) {
        const existing = readIndex(indexPath);
        if (existing && shouldDebounce(existing.last_synced)) {
          const mins = Math.floor((Date.now() - new Date(existing.last_synced).getTime()) / 60000);
          console.log(chalk.yellow(`Index up-to-date (synced ${mins} min ago). Use --force to rescan.`));
          return;
        }
      }

      const index = buildIndex(cwd);
      writeIndex(indexPath, index);

      console.log(chalk.green(`Found ${index.domains.length} domains, index written to .hivemind/specs.json`));
      for (const d of index.domains) {
        console.log(chalk.dim(`  - ${d.name} (${d.source_files.length} files)`));
      }
    } catch (err) {
      console.error(chalk.red(`Error: ${err instanceof Error ? err.message : String(err)}`));
      process.exit(1);
    }
  },
};
