import { describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  createCommsServices,
  executeAdmissionReconnect,
} from "../../src/engine/createCommsServices.js";
import { defaultTestQuiescence, defaultTestSessionAuthority } from "../support/envelopeFixtures.js";
import { denyByDefaultAuthorizer } from "../../src/security/denyByDefaultAuthorizer.js";
import { productionCommsDeps } from "../support/productionCommsDeps.js";

describe("executeAdmissionReconnect failures", () => {
  it("returns propose error for expired plan", async () => {
    const services = createCommsServices({
      mode: "test",
      bindingResolver: { getActiveBinding: () => undefined },
      sessionAuthority: defaultTestSessionAuthority,
      quiescence: defaultTestQuiescence,
      clock: { now: () => "2099-01-01T00:00:00Z" },
    });
    const plan = {
      planId: "plan-expired" as never,
      planDigest: "bad-digest" as never,
      sessionId: "session-x" as never,
      operationTemplateRef: "introduce/1" as never,
      admissionReceipt: {} as never,
      admissionReceiptDigest: "d" as never,
      fromBinding: {} as never,
      toBinding: {
        activationDomainId: "default" as never,
        bindingGeneration: 1 as never,
        epochId: "42" as never,
      } as never,
      oldEndpointRef: "ep-old" as never,
      newEndpointRef: "ep-new" as never,
      expectedChannelGeneration: 1 as never,
      expectedRuntimeHead: "snap" as never,
      authorizationRef: "auth",
      expiresAt: "2020-01-01T00:00:00Z",
      metadata: {} as never,
    };
    const result = await executeAdmissionReconnect({ services, plan });
    expect(result.ok).toBe(false);
  });

  it("createCommsServices production throws without required ports", () => {
    expect(() =>
      createCommsServices({
        mode: "production",
        bindingResolver: { getActiveBinding: () => undefined },
        sessionAuthority: defaultTestSessionAuthority,
        quiescence: defaultTestQuiescence,
      }),
    ).toThrow(/requires identity/);
  });

  it("createCommsServices production uses denyByDefault authorizer", () => {
    const dir = mkdtempSync(join(tmpdir(), "comms-prod-deny-"));
    try {
      const services = createCommsServices({
        ...productionCommsDeps(dir, {
          verifyPeer: async () => ({
            ok: false,
            error: {
              code: "identity_unverified",
              phase: "authenticate",
              message: "no",
              retryable: false,
            },
          }),
        }),
        authorizer: denyByDefaultAuthorizer(),
      });
      expect(services.admin.isFrozen()).toBe(false);
      services.admin.setFrozen(true);
      expect(services.admin.isFrozen()).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
