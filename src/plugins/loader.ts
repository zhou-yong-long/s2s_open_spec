import type { CommandModule } from "yargs";
import type { Config } from "../core/config.js";

export interface Plugin {
  name: string;
  description: string;
  commands: Record<string, CommandModule>;
}

export async function loadPlugins(config: Config, cwd: string): Promise<CommandModule[]> {
  const commands: CommandModule[] = [];
  const plugins = config.plugins;

  if (plugins.workflow) {
    const p = await import("./workflow.js");
    commands.push(...Object.values(p.default.commands));
  }
  if (plugins.doctor) {
    // Will be added in Task 13
  }
  if (plugins.diff) {
    // Will be added in Task 16
  }

  return commands;
}
