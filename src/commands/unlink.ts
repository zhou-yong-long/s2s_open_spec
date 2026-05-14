import type { CommandModule } from "yargs";
import chalk from "chalk";
import { removeLink, buildUriMap, resolvePathToUri } from "../core/links.js";

interface UnlinkArgs {
  source: string;
  target: string;
  type?: string;
}

export const unlinkCommand: CommandModule<{}, UnlinkArgs> = {
  command: "unlink <source> <target>",
  describe: "Remove a link between two specs",
  builder: (yargs) =>
    yargs
      .positional("source", {
        type: "string",
        describe: "Source spec URI or file path",
        demandOption: true,
      })
      .positional("target", {
        type: "string",
        describe: "Target spec URI or file path",
        demandOption: true,
      })
      .option("type", {
        type: "string",
        describe: "Link type to remove (if not specified, removes all links between source and target)",
      }),
  handler: (argv) => {
    const cwd = process.cwd();
    const { uriMap } = buildUriMap(cwd);

    let sourceUri = argv.source;
    let targetUri = argv.target;

    if (!sourceUri.startsWith("hivemind://")) {
      const resolved = resolvePathToUri(sourceUri, uriMap);
      if (!resolved) {
        console.error(chalk.red(`Spec not found: ${sourceUri}`));
        process.exit(1);
      }
      sourceUri = resolved;
    }

    if (!targetUri.startsWith("hivemind://")) {
      const resolved = resolvePathToUri(targetUri, uriMap);
      if (!resolved) {
        console.error(chalk.red(`Spec not found: ${targetUri}`));
        process.exit(1);
      }
      targetUri = resolved;
    }

    const result = removeLink(cwd, sourceUri, targetUri, argv.type);

    if (result.success) {
      console.log(chalk.green(`Removed ${result.removed} link(s) between ${sourceUri} and ${targetUri}`));
    } else {
      console.error(chalk.red(`Error: ${result.error}`));
      process.exit(1);
    }
  },
};
