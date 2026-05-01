#!/usr/bin/env node
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { initCommand } from "./commands/init.js";

function main() {
  yargs(hideBin(process.argv))
    .scriptName("sdd")
    .usage("$0 <command> [options]")
    .command(initCommand)
    .demandCommand(1, "Use one of the commands above")
    .help()
    .version("0.1.0")
    .parse();
}

main();
