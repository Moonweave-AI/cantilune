import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

export function hostEnvPath(repoRoot) {
  return resolve(repoRoot, ".cantilune/host.env");
}

export function loadHostEnv(repoRoot) {
  const file = hostEnvPath(repoRoot);
  if (!existsSync(file)) return {};
  const loaded = {};
  for (const raw of readFileSync(file, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (line.length === 0 || line.startsWith("#") || !line.includes("=")) continue;
    const index = line.indexOf("=");
    const key = line.slice(0, index).trim();
    const value = line.slice(index + 1).trim();
    if (key.length === 0) continue;
    loaded[key] = value;
    if (process.env[key] === undefined || process.env[key] === "") {
      process.env[key] = value;
    }
  }
  return loaded;
}

export function mergeHostEnv(repoRoot, entries) {
  const file = hostEnvPath(repoRoot);
  mkdirSync(dirname(file), { recursive: true });
  const current = existsSync(file) ? loadHostEnv(repoRoot) : {};
  const next = { ...current, ...entries };
  const body = Object.entries(next)
    .filter(([key, value]) => key.length > 0 && value !== undefined && String(value).length > 0)
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");
  writeFileSync(file, `${body}\n`, "utf8");
  return file;
}
