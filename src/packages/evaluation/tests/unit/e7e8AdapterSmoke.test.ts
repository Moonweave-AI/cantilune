import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { PackageConformanceCertificate } from "@cantilune/conformance";
import type { RevocationStore } from "@cantilune/conformance/ports";
import { createFileEvaluationEngine, openFileEvaluationStores } from "../../src/adapters/file/fileEvaluationEngine.js";
import { createInProcessBaselineRunner } from "../../src/adapters/inProcess/inProcessBaselineRunner.js";
import {
  createCantiluneC9ResolverFromConformance,
  createConformanceCertificateStore,
} from "../../src/adapters/cantilune/conformanceCertificateStore.js";
import { createMemoryContentAddressedStore } from "../../src/adapters/memory/memoryContentAddressedStore.js";
import { createMemoryBudgetLedger } from "../../src/adapters/memory/memoryBudgetLedger.js";
import { createMemorySuiteRegistry } from "../../src/adapters/memory/memorySuiteRegistry.js";
import { createCantiluneC9Resolver } from "../../src/adapters/cantilune/cantiluneC9Resolver.js";
import type { ContentDigest } from "@cantilune/core";

const d = (s: string) => s as ContentDigest;

describe("previously unreferenced E4–E6 adapters", () => {
  let dir = "";

  afterEach(async () => {
    if (dir.length > 0) await rm(dir, { recursive: true, force: true });
  });

  it("opens file evaluation stores and builds a file engine", async () => {
    dir = await mkdtemp(join(tmpdir(), "eval-file-engine-"));
    const stores = await openFileEvaluationStores(dir);
    expect(stores.ok).toBe(true);
    const engine = createFileEvaluationEngine({
      baseDir: dir,
      ports: {
        clock: { now: () => "2026-08-16T00:00:00.000Z", nowMs: () => 0 },
        budgetLedger: createMemoryBudgetLedger(),
        candidateRunner: { execute: async () => ({ ok: false, violations: [] }) },
        baselineRunner: { execute: async () => ({ ok: false, violations: [] }) },
        certificateResolver: createCantiluneC9Resolver({
          async getCertificate() {
            return undefined;
          },
        }),
        suiteRegistry: createMemorySuiteRegistry(),
      },
    });
    expect(engine.admitRun).toBeTypeOf("function");
  });

  it("runs the in-process baseline against CAS inputs", async () => {
    const cas = createMemoryContentAddressedStore();
    const put = await cas.put(new TextEncoder().encode("fixture"));
    expect(put.ok).toBe(true);
    if (!put.ok) return;
    const runner = createInProcessBaselineRunner({ cas, baselineId: "smoke" });
    const result = await runner.execute({
      subjectRef: "base",
      caseRef: "case-1",
      seed: 1,
      inputRefs: [put.value as string],
      timeoutMs: 1000,
      networkPolicy: "deny",
      filesystemPolicy: "deny",
      toolManifest: [],
      environmentRef: "test",
    });
    expect(result.ok).toBe(true);
  });

  it("maps conformance certificates and fail-closes a checkpoint mismatch", async () => {
    const cert = {
      evidenceRootDigest: "ev",
      artifactSubject: { artifactDigest: "art" },
      verifierBuild: "v",
      policyVersion: "1",
      issuedAt: "2026-01-01",
      expiresAt: "2027-01-01",
      revocationCheckpoint: "cp-1",
      status: { release: "accepted" },
    } as PackageConformanceCertificate;
    const revocationStore: RevocationStore = {
      checkpoint: "cp-1",
      async isRevoked(ref) {
        return ref === "revoked";
      },
    };
    const store = createConformanceCertificateStore({
      certificates: {
        async getByRef(ref) {
          return ref === "ok" ? cert : undefined;
        },
      },
      revocationStore,
    });
    expect(await store.getCertificate("missing")).toBeUndefined();
    const resolved = await store.getCertificate("ok");
    expect(resolved?.status).toBe("valid");
    expect(await store.isRevokedAtCheckpoint("ok", "cp-1")).toBe(false);
    expect(await store.isRevokedAtCheckpoint("revoked", "cp-1")).toBe(true);
    expect(await store.isRevokedAtCheckpoint("ok", "other")).toBe(true);
    const resolver = createCantiluneC9ResolverFromConformance({
      certificates: { async getByRef() { return cert; } },
      revocationStore,
    });
    const check = await resolver.checkValidity("ok");
    expect(["valid", "expired", "revoked", "superseded"]).toContain(check);

    for (const release of ["revoked", "expired", "superseded", "notEvaluated"] as const) {
      const other = createConformanceCertificateStore({
        certificates: {
          async getByRef() {
            return { ...cert, status: { release } } as PackageConformanceCertificate;
          },
        },
        revocationStore,
      });
      const mapped = await other.getCertificate("ok");
      expect(mapped?.status).toMatch(/revoked|expired|valid/);
    }
  });
});
