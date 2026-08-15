import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { optionalStoreDir, parseArgs } from "../../src/cli/cliArgs.js";
import { createCliAuditSink, createCliConformanceEngine } from "../../src/cli/cliStores.js";
import { createFileAuditSink } from "../../src/adapters/file/fileAuditSink.js";
import { createFileTrustStore } from "../../src/adapters/file/fileTrustStore.js";
import { inspectCommand } from "../../src/cli/inspectCommand.js";
import { sampleManifest } from "../support/conformanceFixtures.js";
import { writeFileSync } from "node:fs";

describe("cli store-dir support", () => {
  it("parseArgs and optionalStoreDir handle --store-dir", () => {
    const parsed = parseArgs(["--manifest", "m.json", "--store-dir", "/tmp/store"]);
    expect(optionalStoreDir(parsed.flags)).toBe("/tmp/store");
    expect(optionalStoreDir(new Map())).toBeUndefined();
    expect(optionalStoreDir(new Map([["store-dir", true]]))).toBeUndefined();
  });

  it("createFileAuditSink appends JSON lines", () => {
    const dir = mkdtempSync(join(tmpdir(), "conformance-audit-"));
    try {
      const sink = createFileAuditSink({ dir });
      sink.emit({
        kind: "verification_started",
        runId: "run-audit",
        profile: "engineeringAdmission",
        subjectDigest: "a".repeat(64),
        at: "2026-01-01T00:00:00.000Z",
      });
      const auditPath = join(dir, "audit.jsonl");
      expect(existsSync(auditPath)).toBe(true);
      expect(readFileSync(auditPath, "utf8")).toContain('"runId":"run-audit"');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("createFileTrustStore initializes trust.json", () => {
    const dir = mkdtempSync(join(tmpdir(), "conformance-trust-"));
    try {
      const store = createFileTrustStore({ dir });
      expect(store.version).toBe("trust/m2");
      expect(store.getRoots("engineeringAdmission")).toEqual([]);
      expect(existsSync(join(dir, "trust.json"))).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("createCliConformanceEngine uses file adapters when store-dir is set", () => {
    const dir = mkdtempSync(join(tmpdir(), "conformance-cli-store-"));
    try {
      const flags = new Map<string, string | true>([["store-dir", dir]]);
      expect(createCliConformanceEngine(flags)).toBeDefined();
      expect(createCliAuditSink(flags)).toBeDefined();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("inspectCommand accepts --store-dir", () => {
    const dir = mkdtempSync(join(tmpdir(), "conformance-cli-inspect-store-"));
    const storeDir = mkdtempSync(join(tmpdir(), "conformance-cli-store-"));
    try {
      const manifestPath = join(dir, "manifest.json");
      writeFileSync(manifestPath, JSON.stringify(sampleManifest()), "utf8");
      const result = inspectCommand(["--manifest", manifestPath, "--store-dir", storeDir]);
      expect(result.kind).toBe("ok");
      expect(existsSync(join(storeDir, "trust.json"))).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
      rmSync(storeDir, { recursive: true, force: true });
    }
  });
});
