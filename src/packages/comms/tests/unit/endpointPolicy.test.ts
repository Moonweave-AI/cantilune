import { describe, expect, it } from "vitest";
import {
  allowlistEndpointPolicy,
  denyByDefaultEndpointPolicy,
  denylistEndpointPolicy,
  matchEndpointPattern,
  permissiveEndpointPolicy,
  PermissiveEndpointPolicy,
} from "../../src/security/endpointPolicy.js";
import type { EndpointPolicy } from "../../src/security/identityVerifier.js";
import { buildTestPeerDescriptor, stubPeerDirectory } from "../support/envelopeFixtures.js";
import { CommsPeerService } from "../../src/engine/commsPeerService.js";
import { descriptorRef } from "../../src/foundation/messageId.js";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createCommsServices } from "../../src/engine/createCommsServices.js";
import { denyByDefaultAuthorizer } from "../../src/security/denyByDefaultAuthorizer.js";
import { productionCommsDeps } from "../support/productionCommsDeps.js";

function resolveEndpointPolicy(
  mode: "test" | "production",
  explicit?: EndpointPolicy,
): EndpointPolicy {
  return explicit ?? (mode === "test" ? permissiveEndpointPolicy() : denyByDefaultEndpointPolicy());
}

describe("matchEndpointPattern", () => {
  it("matches exact and prefix patterns without glob syntax", () => {
    expect(matchEndpointPattern("https://agent.example/a2a", "https://agent.example/a2a")).toBe(
      true,
    );
    expect(matchEndpointPattern("https://agent.example/a2a/v1", "https://agent.example")).toBe(
      true,
    );
    expect(matchEndpointPattern("https://other.example/a2a", "https://agent.example")).toBe(false);
  });

  it("matches glob patterns", () => {
    expect(matchEndpointPattern("https://agent.example/a2a", "https://*.example/*")).toBe(true);
    expect(matchEndpointPattern("https://agent.example/a2a", "https://other.example/*")).toBe(
      false,
    );
  });
});

describe("endpoint policy implementations", () => {
  it("permissiveEndpointPolicy allows any uri", () => {
    const policy = permissiveEndpointPolicy();
    expect(policy.assertEndpointAllowed("https://any.example").ok).toBe(true);
  });

  it("PermissiveEndpointPolicy class remains backwards compatible", () => {
    const policy = new PermissiveEndpointPolicy();
    expect(policy.assertEndpointAllowed("https://any.example").ok).toBe(true);
  });

  it("denyByDefaultEndpointPolicy denies all uris", () => {
    const policy = denyByDefaultEndpointPolicy();
    const result = policy.assertEndpointAllowed("https://agent.example");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("endpoint_policy_violation");
    }
  });

  it("allowlistEndpointPolicy denies all when patterns empty", () => {
    const policy = allowlistEndpointPolicy([]);
    expect(policy.assertEndpointAllowed("https://agent.example").ok).toBe(false);
  });

  it("allowlistEndpointPolicy allows only matching uris", () => {
    const policy = allowlistEndpointPolicy(["https://agent.example/*"]);
    expect(policy.assertEndpointAllowed("https://agent.example/a2a").ok).toBe(true);
    expect(policy.assertEndpointAllowed("https://blocked.example/a2a").ok).toBe(false);
  });

  it("denylistEndpointPolicy denies matching uris and allows others", () => {
    const policy = denylistEndpointPolicy(["https://blocked.example/*"]);
    expect(policy.assertEndpointAllowed("https://blocked.example/a2a").ok).toBe(false);
    expect(policy.assertEndpointAllowed("https://agent.example/a2a").ok).toBe(true);
  });
});

describe("createCommsServices endpoint policy defaults", () => {
  it("selects deny-by-default endpoint policy in production mode", () => {
    const endpointPolicy = resolveEndpointPolicy("production");
    const result = endpointPolicy.assertEndpointAllowed("https://agent.example/a2a");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("endpoint_policy_violation");
    }
  });

  it("selects permissive endpoint policy in test mode", () => {
    const endpointPolicy = resolveEndpointPolicy("test");
    expect(endpointPolicy.assertEndpointAllowed("https://agent.example/a2a").ok).toBe(true);
  });

  it("honors explicit endpointPolicy regardless of mode", () => {
    const endpointPolicy = resolveEndpointPolicy(
      "production",
      allowlistEndpointPolicy(["https://agent.example/*"]),
    );
    expect(endpointPolicy.assertEndpointAllowed("https://agent.example/a2a").ok).toBe(true);
  });

  it("wires production createCommsServices without throwing", () => {
    const dir = mkdtempSync(join(tmpdir(), "comms-policy-prod-"));
    try {
      const services = createCommsServices({
        ...productionCommsDeps(dir, {
          verifyPeer: async () => ({
            ok: false as const,
            error: {
              code: "identity_unverified" as const,
              phase: "authenticate" as const,
              message: "no",
              retryable: false,
            },
          }),
        }),
        authorizer: denyByDefaultAuthorizer(),
      });
      expect(services.peer).toBeDefined();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("CommsPeerService with allowlist policy", () => {
  it("rejects peer when endpoint uri is not allowlisted", async () => {
    const descriptor = buildTestPeerDescriptor({
      endpoints: [
        {
          endpointRef: "endpoint-blocked" as never,
          transport: "a2a",
          uri: "https://blocked.example/a2a",
          wireVersions: [1 as never],
          maxFrameBytes: 65536,
        },
      ],
    });
    const service = new CommsPeerService({
      directory: stubPeerDirectory(async () => descriptor),
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
      endpointPolicy: allowlistEndpointPolicy(["https://agent.example/*"]),
    });
    const result = await service.resolvePeer(descriptorRef(descriptor.descriptorRef as string));
    expect(result.ok).toBe(false);
  });
});
