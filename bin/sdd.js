#!/usr/bin/env node
import { spawnSync } from "child_process";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const tsx = join(__dirname, "..", "node_modules", ".bin", "tsx");
const src = join(__dirname, "..", "src", "index.ts");

const result = spawnSync(tsx, [src, ...process.argv.slice(2)], {
  stdio: "inherit",
  cwd: process.cwd(),
});

process.exit(result.status ?? 1);
