#!/usr/bin/env node
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { initCommand } from "./commands/init.js";
import { newCommand } from "./commands/new.js";
import { statusCommand } from "./commands/status.js";
import { amendCommand } from "./commands/amend.js";
import { syncSpecsCommand } from "./commands/sync-specs.js";
import { linkCommand } from "./commands/link.js";
import { unlinkCommand } from "./commands/unlink.js";
import { linksCommand } from "./commands/links.js";
import { graphCommand } from "./commands/graph.js";
import { syncLinksCommand } from "./commands/sync-links.js";
import { loadPlugins } from "./plugins/loader.js";
import { readConfig } from "./core/config.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(join(__dirname, "..", "package.json"), "utf-8"));
const CLI_VERSION = pkg.version as string;

async function main() {
  const cwd = process.cwd();
  let config;
  try { config = readConfig(cwd); } catch { config = undefined; }

  const y = yargs(hideBin(process.argv))
    .scriptName("sdd")
    .usage("$0 <command> [options]")
    .command(initCommand)
    .command(newCommand)
    .command(statusCommand)
    .command(amendCommand)
    .command(syncSpecsCommand)
    .command(linkCommand)
    .command(unlinkCommand)
    .command(linksCommand)
    .command(graphCommand)
    .command(syncLinksCommand)
    .demandCommand(1, "Use one of the commands above")
    .help()
    .version(CLI_VERSION);

  if (config) {
    const pluginCommands = await loadPlugins(config, cwd);
    for (const cmd of pluginCommands) y.command(cmd);
  }

  y.parse();
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
