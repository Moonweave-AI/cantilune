import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  sampleInventory,
  sampleManifest,
  SAMPLE_OBSERVED,
  FIXTURE_ARTIFACT_DIGESTS,
} from "../support/conformanceFixtures.js";
import { cliBuilt, runCli } from "../support/runCli.js";

describe("L6 pack + CLI smoke", () => {
  it.skipIf(!cliBuilt())("runs built CLI entry after package build", () => {
    const help = runCli(["help"]);
    expect(help.exitCode).toBe(0);
    expect(help.stdout).toContain("verify-package");
  });

  it.skipIf(!cliBuilt())("verify-package end-to-end via node dist/cli/main.js", () => {
    const dir = mkdtempSync(join(tmpdir(), "conformance-pack-"));
    try {
      const manifestPath = join(dir, "manifest.json");
      const inventoryPath = join(dir, "inventory.json");
      const observedPath = join(dir, "observed.json");
      const artifactsPath = join(dir, "artifacts.json");
      writeFileSync(manifestPath, JSON.stringify(sampleManifest()), "utf8");
      writeFileSync(inventoryPath, JSON.stringify(sampleInventory()), "utf8");
      writeFileSync(observedPath, JSON.stringify([...SAMPLE_OBSERVED]), "utf8");
      writeFileSync(artifactsPath, JSON.stringify([...FIXTURE_ARTIFACT_DIGESTS]), "utf8");

      const result = runCli([
        "verify-package",
        "--manifest",
        manifestPath,
        "--inventory",
        inventoryPath,
        "--observed",
        observedPath,
        "--artifacts",
        artifactsPath,
      ]);
      expect(result.exitCode).toBe(0);
      const parsed = JSON.parse(result.stdout) as { profile: string; cacheKey?: string };
      expect(parsed.profile).toBe("engineeringAdmission");
      expect(parsed.cacheKey).toMatch(/\|/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("npm pack dry-run includes CLI bin", async () => {
    const { execSync } = await import("node:child_process");
    const { readFileSync, existsSync } = await import("node:fs");
    const { fileURLToPath } = await import("node:url");
    const packageRoot = join(fileURLToPath(new URL(".", import.meta.url)), "../..");
    execSync("pnpm build", { cwd: packageRoot, stdio: "ignore" });
    expect(existsSync(join(packageRoot, "dist/cli/main.js"))).toBe(true);
    const output = execSync("npm pack --dry-run 2>&1", {
      cwd: packageRoot,
      encoding: "utf8",
    });
    const manifest = JSON.parse(readFileSync(join(packageRoot, "package.json"), "utf8")) as {
      bin?: Record<string, string>;
    };
    expect(manifest.bin?.["conformance-cli"]).toBe("./dist/cli/main.js");
    expect(output).toContain("dist/");
  });
});
