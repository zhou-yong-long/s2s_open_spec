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
  plugins: { doctor: false, diff: false, workflow: false, board: false, git_hooks: false, ai: false },
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

function deepMerge<T extends Record<string, unknown>>(defaults: T, overrides: Partial<T>): T {
  const result = { ...defaults } as Record<string, unknown>;
  for (const key of Object.keys(overrides)) {
    const ov = overrides[key];
    const dv = defaults[key as keyof T];
    if (ov !== null && typeof ov === "object" && !Array.isArray(ov) && typeof dv === "object" && !Array.isArray(dv)) {
      result[key] = deepMerge(dv as Record<string, unknown>, ov as Record<string, unknown>);
    } else if (ov !== undefined) {
      result[key] = ov;
    }
  }
  return result as T;
}
