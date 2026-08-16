#!/usr/bin/env node
/**
 * SemVer 2.0 §4: 0.y.z is initial development; the public API is not stable.
 * Owner 2026-08-16: keep 0.x even after FCP entry.
 */
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const packagesRoot = join(dirname(fileURLToPath(import.meta.url)), "../src/packages");
const failures = [];

for (const name of readdirSync(packagesRoot, { withFileTypes: true })) {
  if (!name.isDirectory()) continue;
  const file = join(packagesRoot, name.name, "package.json");
  let pkg;
  try {
    pkg = JSON.parse(readFileSync(file, "utf8"));
  } catch {
    continue;
  }
  if (pkg.private === true) continue;
  const version = String(pkg.version ?? "");
  if (!/^0\.\d+\.\d+/.test(version)) {
    failures.push(`${pkg.name ?? name.name} version ${version} is not 0.x`);
  }
}

if (failures.length > 0) {
  process.stderr.write(`${failures.join("\n")}\n`);
  process.exit(1);
}
process.stdout.write("all publishable packages remain SemVer 0.x\n");
