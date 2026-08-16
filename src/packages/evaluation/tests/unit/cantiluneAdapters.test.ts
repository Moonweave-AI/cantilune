import { describe, it, expect } from "vitest";
import {
  createCantiluneReplayAdapter,
  type ReplayPort,
} from "../../src/adapters/cantilune/cantiluneReplayAdapter.js";
import {
  createCantiluneC9Resolver,
  type CertificateStorePort,
} from "../../src/adapters/cantilune/cantiluneC9Resolver.js";
import type { ResolvedCertificate } from "../../src/ports/productEvidence.js";
import type { ContentDigest } from "@cantilune/core";

const d = (s: string) => s as ContentDigest;

const resolvedCert: ResolvedCertificate = {
  certificateDigest: d("cert-d"),
  artifactSubjectDigest: d("artifact-d"),
  verifierBuild: "build-1",
  policyVersion: "v1",
  evidenceRootDigest: d("evidence-d"),
  issuedAt: "2026-01-01",
  expiresAt: "2027-01-01",
  status: "valid",
};

describe("Cantilune replay adapter", () => {
  it("returns replay result on success", async () => {
    const port: ReplayPort = {
      async replayFromSnapshot() {
        return {
          terminalSnapshotRef: "snap-final",
          stepCount: 3,
          resultDigest: d("replay-d"),
        };
      },
    };
    const adapter = createCantiluneReplayAdapter(port);
    const result = await adapter.replay("snap-0", [{ event: 1 }]);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.stepCount).toBe(3);
      expect(result.value.terminalSnapshotRef).toBe("snap-final");
    }
  });

  it("maps replay failure to evidence_incomplete violation", async () => {
    const port: ReplayPort = {
      async replayFromSnapshot() {
        throw new Error("replay engine unavailable");
      },
    };
    const adapter = createCantiluneReplayAdapter(port);
    const result = await adapter.replay("snap-0", []);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.violations[0]!.code).toBe("evidence_incomplete");
      expect(result.violations[0]!.message).toContain("replay engine unavailable");
    }
  });

  it("handles non-Error throwables", async () => {
    const port: ReplayPort = {
      async replayFromSnapshot() {
        throw "fatal";
      },
    };
    const adapter = createCantiluneReplayAdapter(port);
    const result = await adapter.replay("snap-0", []);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.violations[0]!.message).toContain("unknown error");
  });
});

describe("Cantilune C9 resolver", () => {
  it("resolves an existing certificate", async () => {
    const store: CertificateStorePort = {
      async getCertificate(ref) {
        return ref === "cert-1" ? resolvedCert : undefined;
      },
    };
    const resolver = createCantiluneC9Resolver(store);
    const result = await resolver.resolve("cert-1");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.status).toBe("valid");
  });

  it("rejects missing certificate on resolve", async () => {
    const store: CertificateStorePort = {
      async getCertificate() {
        return undefined;
      },
    };
    const resolver = createCantiluneC9Resolver(store);
    const result = await resolver.resolve("missing");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.violations[0]!.code).toBe("subject_certificate_invalid");
  });

  it("returns expired when certificate is missing on checkValidity", async () => {
    const store: CertificateStorePort = {
      async getCertificate() {
        return undefined;
      },
    };
    const resolver = createCantiluneC9Resolver(store);
    expect(await resolver.checkValidity("missing")).toBe("expired");
  });

  it("returns certificate status on checkValidity", async () => {
    const store: CertificateStorePort = {
      async getCertificate() {
        return { ...resolvedCert, status: "revoked" };
      },
    };
    const resolver = createCantiluneC9Resolver(store);
    expect(await resolver.checkValidity("cert-1")).toBe("revoked");
  });

  it("treats missing certificate as revoked on checkRevocation", async () => {
    const store: CertificateStorePort = {
      async getCertificate() {
        return undefined;
      },
    };
    const resolver = createCantiluneC9Resolver(store);
    expect(await resolver.checkRevocation("missing", "checkpoint-1")).toBe(true);
  });

  it("detects revoked certificate on checkRevocation", async () => {
    const store: CertificateStorePort = {
      async getCertificate() {
        return { ...resolvedCert, status: "revoked" };
      },
    };
    const resolver = createCantiluneC9Resolver(store);
    expect(await resolver.checkRevocation("cert-1", "checkpoint-1")).toBe(true);
  });

  it("returns false for valid certificate on checkRevocation", async () => {
    const store: CertificateStorePort = {
      async getCertificate() {
        return resolvedCert;
      },
    };
    const resolver = createCantiluneC9Resolver(store);
    expect(await resolver.checkRevocation("cert-1", "checkpoint-1")).toBe(false);
  });

  it("fail-closes when checkpoint is empty (A54)", async () => {
    const store: CertificateStorePort = {
      async getCertificate() {
        return resolvedCert;
      },
    };
    const resolver = createCantiluneC9Resolver(store);
    expect(await resolver.checkRevocation("cert-1", "")).toBe(true);
  });

  it("fail-closes when caller checkpoint mismatches certificate checkpoint (A54)", async () => {
    const store: CertificateStorePort = {
      async getCertificate() {
        return { ...resolvedCert, revocationCheckpoint: "checkpoint-bound" };
      },
    };
    const resolver = createCantiluneC9Resolver(store);
    expect(await resolver.checkRevocation("cert-1", "checkpoint-other")).toBe(true);
    expect(await resolver.checkRevocation("cert-1", "checkpoint-bound")).toBe(false);
  });

  it("delegates to store.isRevokedAtCheckpoint when present", async () => {
    const store: CertificateStorePort = {
      async getCertificate() {
        return resolvedCert;
      },
      async isRevokedAtCheckpoint(_ref, checkpoint) {
        return checkpoint === "revoked-at";
      },
    };
    const resolver = createCantiluneC9Resolver(store);
    expect(await resolver.checkRevocation("cert-1", "revoked-at")).toBe(true);
    expect(await resolver.checkRevocation("cert-1", "still-valid")).toBe(false);
  });
});

describe("runtime public replay port", () => {
  it("maps a successful runtime.replay() to ReplayPort", async () => {
    const { createRuntimePublicReplayPort } = await import(
      "../../src/adapters/cantilune/runtimeReplayPort.js"
    );
    const { createCantiluneReplayAdapter } = await import(
      "../../src/adapters/cantilune/cantiluneReplayAdapter.js"
    );
    const port = createRuntimePublicReplayPort({
      replay() {
        return { ok: true, terminalRef: "snap:final", steps: [{}, {}] };
      },
    });
    const oracle = createCantiluneReplayAdapter(port);
    const result = await oracle.replay("snap:0", []);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.terminalSnapshotRef).toBe("snap:final");
      expect(result.value.stepCount).toBe(2);
    }
  });

  it("surfaces a failed runtime.replay() as evidence_incomplete", async () => {
    const { createRuntimePublicReplayPort } = await import(
      "../../src/adapters/cantilune/runtimeReplayPort.js"
    );
    const { createCantiluneReplayAdapter } = await import(
      "../../src/adapters/cantilune/cantiluneReplayAdapter.js"
    );
    const oracle = createCantiluneReplayAdapter(
      createRuntimePublicReplayPort({
        replay() {
          return { ok: false, violation: { message: "chain broken" } };
        },
      }),
    );
    const result = await oracle.replay("snap:0", []);
    expect(result.ok).toBe(false);
  });
});

describe("observability read bridge", () => {
  it("returns the observeCommitted bundle as a read-only observation", async () => {
    const { createObservabilityReadBridge } = await import(
      "../../src/adapters/cantilune/observabilityReadBridge.js"
    );
    const reader = createObservabilityReadBridge({
      observeCommitted: () => ({ structure: { kind: "serial" } }),
      ports: {},
    });
    const result = await reader.readObservations("run-1", "epoch-a", "epoch-b");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toHaveLength(1);
  });

  it("fail-closes when observeCommitted throws", async () => {
    const { createObservabilityReadBridge } = await import(
      "../../src/adapters/cantilune/observabilityReadBridge.js"
    );
    const reader = createObservabilityReadBridge({
      observeCommitted: () => {
        throw new Error("access denied");
      },
      ports: {},
    });
    const result = await reader.readObservations("run-1", "epoch-a", "epoch-b");
    expect(result.ok).toBe(false);
  });
});
