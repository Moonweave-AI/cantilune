import { describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createCommsServices } from "../../src/engine/createCommsServices.js";
import { denyByDefaultAuthorizer } from "../../src/security/denyByDefaultAuthorizer.js";
import { testRuntimeCommitPort } from "../../src/engine/testRuntimeCommitPort.js";
import { defaultTestQuiescence, defaultTestSessionAuthority } from "../support/envelopeFixtures.js";

describe("createCommsServices modes", () => {
  it("creates production services when all ports provided", () => {
    const services = createCommsServices({
      mode: "production",
      bindingResolver: { getActiveBinding: () => undefined },
      sessionAuthority: defaultTestSessionAuthority,
      quiescence: defaultTestQuiescence,
      runtimeCommit: testRuntimeCommitPort(),
      observation: {
        observe: async () => ({ ok: true, value: { snapshotRef: "snap-1" as never } }),
      },
      identity: {
        verifyPeer: async () => ({
          ok: false,
          error: {
            code: "identity_unverified",
            phase: "authenticate",
            message: "no",
            retryable: false,
          },
        }),
      },
      authorizer: denyByDefaultAuthorizer(),
    });
    expect(services.admin.isFrozen()).toBe(false);
  });

  it("uses file store when storeDir provided", () => {
    const dir = mkdtempSync(join(tmpdir(), "comms-svc-file-"));
    const services = createCommsServices({
      mode: "test",
      storeDir: dir,
      bindingResolver: { getActiveBinding: () => undefined },
      sessionAuthority: defaultTestSessionAuthority,
      quiescence: defaultTestQuiescence,
    });
    services.store.putPeer({
      descriptorRef: "desc-svc-file" as never,
      digest: "d" as never,
      runtimeInstanceId: "rt" as never,
      activationDomainId: "default" as never,
      actors: [],
      endpoints: [],
      supportedWireVersions: [1 as never],
      supportedTransports: ["loopback"],
      supportedFeatures: [],
      supportedOperations: ["send"],
      schemaBinding: { schemaId: "s", revisionId: "r", digest: "d" as never } as never,
      issuedAt: "2026-08-11T16:00:00Z",
      expiresAt: "2099-01-01T00:00:00Z",
      evidenceRefs: [],
      provenance: "test",
    });
    const reloaded = createCommsServices({
      mode: "test",
      storeDir: dir,
      bindingResolver: { getActiveBinding: () => undefined },
      sessionAuthority: defaultTestSessionAuthority,
      quiescence: defaultTestQuiescence,
    });
    expect(reloaded.store.getPeer("desc-svc-file" as never)).toBeDefined();
    rmSync(dir, { recursive: true, force: true });
  });
});
