import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadCwdHostEnv } from "../../src/wiring/loadHostEnv.js";

describe("loadCwdHostEnv", () => {
  it("loads missing keys from .cantilune/host.env and leaves set keys alone", () => {
    const root = mkdtempSync(join(tmpdir(), "cantilune-host-env-"));
    mkdirSync(join(root, ".cantilune"));
    writeFileSync(
      join(root, ".cantilune/host.env"),
      ["# comment", "CANTILUNE_SANDBOX_ISOLATION=runsc", "ALREADY_SET=from-file", ""].join("\n"),
      "utf8",
    );
    const env: NodeJS.ProcessEnv = { ALREADY_SET: "from-process" };
    loadCwdHostEnv(root, env);
    expect(env.CANTILUNE_SANDBOX_ISOLATION).toBe("runsc");
    expect(env.ALREADY_SET).toBe("from-process");
    loadCwdHostEnv(join(root, "missing"), env);
    expect(env.CANTILUNE_SANDBOX_ISOLATION).toBe("runsc");
  });
});
