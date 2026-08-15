#!/usr/bin/env node
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = resolve(root, "artifacts/sbom");
mkdirSync(outDir, { recursive: true });
const outFile = resolve(outDir, "conformance.cyclonedx.json");

const pkg = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"));
const lockPath = resolve(root, "../../../pnpm-lock.yaml");
const lockDigest = createHash("sha256")
  .update(readFileSync(lockPath))
  .digest("hex");

const components = Object.entries(pkg.dependencies ?? {}).map(([name, version]) => ({
  type: "library",
  name,
  version: String(version).replace(/^workspace:/, "0.0.1"),
  purl: `pkg:npm/${name.replace("@", "%40")}@${String(version).replace(/^workspace:/, "0.0.1")}`,
}));

const bom = {
  bomFormat: "CycloneDX",
  specVersion: "1.5",
  serialNumber: `urn:uuid:${createHash("sha256").update(outFile).digest("hex").slice(0, 32)}`,
  version: 1,
  metadata: {
    timestamp: new Date().toISOString(),
    component: {
      type: "application",
      name: pkg.name,
      version: pkg.version,
    },
    properties: [{ name: "pnpm-lock-digest", value: lockDigest }],
  },
  components,
};

writeFileSync(outFile, `${JSON.stringify(bom, null, 2)}\n`, "utf8");
console.log(`SBOM written to ${outFile}`);
