#!/usr/bin/env node
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { initCommand } from "./commands/init.js";
import { newCommand } from "./commands/new.js";
import { statusCommand } from "./commands/status.js";
import { amendCommand } from "./commands/amend.js";
import { syncSpecsCommand } from "./commands/sync-specs.js";
import { loadPlugins } from "./plugins/loader.js";
import { readConfig } from "./core/config.js";

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
    .demandCommand(1, "Use one of the commands above")
    .help()
    .version("0.1.0");

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
