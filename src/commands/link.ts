import type { CommandModule } from "yargs";
import chalk from "chalk";
import { addLink, buildUriMap, resolvePathToUri } from "../core/links.js";

interface LinkArgs {
  source: string;
  target: string;
  type?: string;
  note?: string;
}

export const linkCommand: CommandModule<{}, LinkArgs> = {
  command: "link <source> <target>",
  describe: "Add a link between two specs",
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
        default: "relates",
        describe: "Link type (parent, child, blocks, blocked-by, relates, duplicates)",
      })
      .option("note", {
        type: "string",
        describe: "Optional note for the link",
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

    const result = addLink(cwd, sourceUri, targetUri, argv.type!, argv.note);

    if (result.success) {
      console.log(chalk.green(`Linked: ${sourceUri} --[${argv.type}]--> ${targetUri}`));
    } else {
      console.error(chalk.red(`Error: ${result.error}`));
      process.exit(1);
    }
  },
};
