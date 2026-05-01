import { execSync } from "child_process";

export function gitInit(cwd: string): void {
  execSync("git init", { cwd, stdio: "pipe" });
}

export function isGitRepo(cwd: string): boolean {
  try {
    execSync("git rev-parse --git-dir", { cwd, stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}

export function getCurrentUser(cwd: string): string {
  try {
    return execSync("git config user.name", { cwd, encoding: "utf-8" }).trim();
  } catch {
    return "";
  }
}

export function getHeadCommit(cwd: string): string {
  try {
    return execSync("git rev-parse HEAD", { cwd, encoding: "utf-8" }).trim();
  } catch {
    return "";
  }
}

export function getDiffStat(fromCommit: string, files: string[], cwd: string): string {
  try {
    const fileArgs = files.length > 0 ? `-- ${files.join(" ")}` : "";
    return execSync(`git diff --stat ${fromCommit}..HEAD ${fileArgs}`, { cwd, encoding: "utf-8" }).trim();
  } catch {
    return "";
  }
}
