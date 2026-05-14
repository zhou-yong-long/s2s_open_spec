import type { CommandModule, Argv } from "yargs";
import chalk from "chalk";
import { readLinks, buildLinksIndex, checkConsistency, syncFrontmatter, calculateImplicitLinks, buildUriMap } from "../core/links.js";
import { existsSync, readFileSync } from "fs";
import { join } from "path";

interface SyncLinksArgs {
  submit?: boolean;
  includeImplicit?: boolean;
  check?: boolean;
  repair?: boolean;
}

export const syncLinksCommand: CommandModule<{}, SyncLinksArgs> = {
  command: "sync-links",
  describe: "Sync spec links to/from Hive Mind",
  builder: (yargs: Argv<{}>): Argv<SyncLinksArgs> =>
    yargs
      .option("submit", {
        type: "boolean",
        describe: "Submit links to Hive Mind",
      })
      .option("include-implicit", {
        type: "boolean",
        describe: "Include implicit links (same team/domain)",
      })
      .option("check", {
        type: "boolean",
        describe: "Check consistency between links.yaml and frontmatter",
      })
      .option("repair", {
        type: "boolean",
        describe: "Repair frontmatter inconsistencies from links.yaml",
      }) as Argv<SyncLinksArgs>,
  handler: (argv) => {
    const cwd = process.cwd();

    // Check consistency if requested
    if (argv.check) {
      const result = checkConsistency(cwd);
      if (result.consistent) {
        console.log(chalk.green("✓ Links and frontmatter are consistent"));
      } else {
        console.log(chalk.yellow(`Found ${result.issues.length} inconsistencies:`));
        for (const issue of result.issues) {
          console.log(chalk.yellow(`  - ${issue}`));
        }
      }
      return;
    }

    // Repair if requested
    if (argv.repair) {
      console.log(chalk.blue("Repairing frontmatter from links.yaml..."));
      const result = syncFrontmatter(cwd);
      console.log(chalk.green(`Synced ${result.synced} links`));
      if (result.errors.length > 0) {
        console.log(chalk.yellow(`Errors: ${result.errors.length}`));
        for (const err of result.errors) {
          console.log(chalk.yellow(`  - ${err}`));
        }
      }
      return;
    }

    // Build links index
    const data = readLinks(cwd);
    const { specInfos } = buildUriMap(cwd);

    // Determine team from specInfos (first spec with a team) or .hivemind/specs.json
    let team = "local";
    const specTeam = specInfos.find((s) => s.team)?.team;
    if (specTeam) {
      team = specTeam;
    } else {
      // Fallback to .hivemind/specs.json
      const hiveIndexPath = join(cwd, ".hivemind", "specs.json");
      if (existsSync(hiveIndexPath)) {
        try {
          const hiveIndex = JSON.parse(readFileSync(hiveIndexPath, "utf-8"));
          if (hiveIndex.team) team = hiveIndex.team;
        } catch { /* use default */ }
      }
    }

    // Add implicit links if requested
    let links = data.links;
    if (argv.includeImplicit) {
      const implicit = calculateImplicitLinks(specInfos);

      // Only add implicit links that don't already exist
      const existingKeys = new Set(links.map((l) => `${l.source}|${l.target}|${l.type}`));
      for (const impl of implicit) {
        const key = `${impl.source}|${impl.target}|${impl.type}`;
        if (!existingKeys.has(key)) {
          links.push(impl);
        }
      }

      console.log(chalk.green(`Added ${implicit.length} implicit links`));
    }

    const index = buildLinksIndex(cwd);
    index.links = links;

    // Generate resource JSON
    const resourceJson = {
      name: "Spec Links Index",
      uri: `hivemind://${team}/specs/links`,
      mimeType: "application/json",
      content: index,
    };

    if (argv.submit) {
      // Submit to Hive Mind - output structured payload for AI agent to submit
      console.log(chalk.blue("Submitting links to Hive Mind..."));
      console.log("");
      console.log(chalk.bold("=== HIVE MIND SUBMISSION PAYLOAD ==="));
      console.log(JSON.stringify(resourceJson, null, 2));
      console.log(chalk.bold("=== END PAYLOAD ==="));
      console.log("");
      console.log(chalk.gray("AI Agent: Use hivemind_submit_resource tool with the above payload to upload."));
      console.log(chalk.green("✓ Links ready for Hive Mind submission"));
    } else {
      // Output JSON to stdout
      console.log(JSON.stringify(resourceJson, null, 2));
    }
  },
};
