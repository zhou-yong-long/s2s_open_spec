import type { CommandModule } from "yargs";
import type { Config } from "../core/config.js";

export interface Plugin {
  name: string;
  description: string;
  commands: Record<string, CommandModule>;
}

export async function loadPlugins(config: Config, cwd: string): Promise<CommandModule[]> {
  const commands: CommandModule[] = [];
  // Plugins are loaded later — this just keeps the interface ready.
  return commands;
}
