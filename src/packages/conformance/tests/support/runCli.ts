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

/**
 * Whether the conformance CLI is runnable from `dist/`.
 *
 * The `pretest`/`pretest:coverage` hooks build the package, so this probe is
 * expected to be true; it exists so a developer running Vitest directly against
 * an unbuilt tree gets a clear message instead of a wall of spawn failures. A
 * false result must never quietly drop the CLI evidence, so callers that gate
 * on it are responsible for failing loudly — see {@link requireCliBuilt}.
 */
export function cliBuilt(): boolean {
  try {
    const probe = runCli(["help"]);
    return probe.exitCode === 0;
  } catch {
    return false;
  }
}

/** Assert the CLI is built, with the command that fixes it when it is not. */
export function requireCliBuilt(): void {
  if (cliBuilt()) return;
  throw new Error(
    `Conformance CLI evidence requires a built package: ${CLI_MAIN} is not runnable. ` +
      `Run \`pnpm --filter @cantilune/conformance... build\` first.`,
  );
}
