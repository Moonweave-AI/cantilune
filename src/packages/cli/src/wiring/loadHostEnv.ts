import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

export function loadCwdHostEnv(
  cwd: string = process.cwd(),
  env: NodeJS.ProcessEnv = process.env,
): void {
  const file = resolve(cwd, ".cantilune/host.env");
  if (!existsSync(file)) return;
  for (const raw of readFileSync(file, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (line.length === 0 || line.startsWith("#") || !line.includes("=")) continue;
    const index = line.indexOf("=");
    const key = line.slice(0, index).trim();
    const value = line.slice(index + 1).trim();
    if (key.length === 0) continue;
    if (env[key] === undefined || env[key] === "") {
      env[key] = value;
    }
  }
}
