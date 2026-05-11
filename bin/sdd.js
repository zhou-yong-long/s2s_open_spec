#!/usr/bin/env node
import { spawnSync } from "child_process";
import { existsSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const distEntry = join(root, "dist", "index.js");
const tsx = join(root, "node_modules", ".bin", "tsx");
const src = join(root, "src", "index.ts");
const argv = process.argv.slice(2);

let result;
if (existsSync(distEntry)) {
  result = spawnSync(process.execPath, [distEntry, ...argv], { stdio: "inherit", cwd: process.cwd() });
} else {
  result = spawnSync(tsx, [src, ...argv], { stdio: "inherit", cwd: process.cwd() });
}

process.exit(result.status ?? 1);
