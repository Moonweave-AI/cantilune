import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
export const CLI_MAIN = path.join(packageRoot, "dist/cli/main.js");

export interface CliRunResult {
  readonly exitCode: number | null;
  readonly stdout: string;
  readonly stderr: string;
}

export function runCli(args: readonly string[]): CliRunResult {
  const result = spawnSync(process.execPath, [CLI_MAIN, ...args], {
    encoding: "utf8",
    env: { ...process.env, NODE_NO_WARNINGS: "1" },
  });
  return {
    exitCode: result.status,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}

export function cliBuilt(): boolean {
  try {
    const probe = runCli(["help"]);
    return probe.exitCode === 0;
  } catch {
    return false;
  }
}
