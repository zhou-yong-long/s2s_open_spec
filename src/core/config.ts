import { readFileSync, mkdirSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import yaml from "js-yaml";

export type Mode = "flat" | "domain" | "team";
export type Template = "minimal" | "default" | "full";

export interface PluginSettings {
  doctor: boolean;
  diff: boolean;
  workflow: boolean;
  board: boolean;
  git_hooks: boolean;
  ai: boolean;
}

export interface Config {
  version: string;
  mode: Mode;
  template: Template;
  doctor: { flat_max: number; similarity_threshold: number };
  paths: { specs: string; active: string; completed: string; archived: string };
  plugins: PluginSettings;
  extractors: Record<string, string | null>;
}

export const defaultConfig: Config = {
  version: "1",
  mode: "flat",
  template: "default",
  doctor: { flat_max: 12, similarity_threshold: 0.6 },
  paths: { specs: "specs/", active: "specs/active/", completed: "specs/completed/", archived: "specs/archived/" },
  plugins: { doctor: true, diff: true, workflow: true, board: true, git_hooks: false, ai: false },
  extractors: { ".ts": "typescript", ".py": "python", ".go": null },
};

export function readConfig(projectRoot: string): Config {
  const configPath = join(projectRoot, ".sdd", "config.yaml");
  if (!existsSync(configPath)) return { ...defaultConfig };
  const raw = readFileSync(configPath, "utf-8");
  const parsed = yaml.load(raw) as Partial<Config>;
  if (!parsed) return { ...defaultConfig };
  return deepMerge(defaultConfig, parsed);
}

export function writeConfig(projectRoot: string, config: Config): void {
  mkdirSync(join(projectRoot, ".sdd"), { recursive: true });
  writeFileSync(join(projectRoot, ".sdd", "config.yaml"), yaml.dump(config, { indent: 2, lineWidth: 120 }));
}

function deepMerge(defaults: Config, overrides: Partial<Config>): Config {
  return {
    ...defaults,
    ...overrides,
    doctor: overrides.doctor ? { ...defaults.doctor, ...overrides.doctor } : defaults.doctor,
    paths: overrides.paths ? { ...defaults.paths, ...overrides.paths } : defaults.paths,
    plugins: overrides.plugins ? { ...defaults.plugins, ...overrides.plugins } : defaults.plugins,
    extractors: overrides.extractors ? { ...defaults.extractors, ...overrides.extractors } : defaults.extractors,
  };
}
