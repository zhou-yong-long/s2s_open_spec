import type { CommandModule, Argv } from "yargs";
import chalk from "chalk";
import { queryLinks, buildUriMap, resolvePathToUri, parseSpecUri } from "../core/links.js";

interface LinksArgs {
  spec?: string;
  type?: string;
  direction?: "in" | "out" | "all";
}

export const linksCommand: CommandModule<{}, LinksArgs> = {
  command: "links [spec]",
  describe: "List links between specs",
  builder: (yargs: Argv<{}>): Argv<LinksArgs> =>
    yargs
      .positional("spec", {
        type: "string",
        describe: "Spec URI or file path to filter links (omit to list all)",
      })
      .option("type", {
        type: "string",
        describe: "Filter by link type",
      })
      .option("direction", {
        type: "string",
        choices: ["in", "out", "all"],
        default: "all",
        describe: "Direction filter: in (pointing to spec), out (from spec), all",
      }) as Argv<LinksArgs>,
  handler: (argv) => {
    const cwd = process.cwd();
    const { uriMap } = buildUriMap(cwd);

    let specUri: string | undefined;
    if (argv.spec) {
      if (argv.spec.startsWith("hivemind://")) {
        specUri = argv.spec;
      } else {
        const resolved = resolvePathToUri(argv.spec, uriMap);
        specUri = resolved || undefined;
        if (!specUri) {
          console.error(chalk.red(`Spec not found: ${argv.spec}`));
          process.exit(1);
        }
      }
    }

    const links = queryLinks(cwd, {
      specUri,
      type: argv.type,
      direction: argv.direction,
    });

    if (links.length === 0) {
      console.log(chalk.gray(specUri ? `No links found for ${specUri}` : "No links defined"));
      return;
    }

    console.log(chalk.bold(`Links (${links.length}):\n`));

    for (const link of links) {
      const parsed = parseSpecUri(link.source);
      const sourceLabel = parsed?.slug || link.source;
      const targetParsed = parseSpecUri(link.target);
      const targetLabel = targetParsed?.slug || link.target;

      const arrow = link.type === "relates" || link.type === "duplicates" ? "───" : "──→";
      const typeColor = link.type === "blocks" || link.type === "blocked-by"
        ? chalk.yellow
        : link.type === "parent" || link.type === "child"
          ? chalk.cyan
          : chalk.white;

      console.log(`${sourceLabel} ${typeColor(`${arrow} [${link.type}]`)} ${targetLabel}`);
      if (link.note) {
        console.log(chalk.dim(`  Note: ${link.note}`));
      }
    }
  },
};
