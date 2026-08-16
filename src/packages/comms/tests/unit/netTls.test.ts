import { describe, expect, it } from "vitest";
import {
  assertTlsMaterial,
  buildClientTlsOptions,
  buildServerTlsOptions,
  extractPeerFingerprint,
  NET_TLS_MIN_VERSION,
} from "../../src/transports/net/netTls.js";
import type { TLSSocket } from "node:tls";
import { issueSelfSignedMtlsPair } from "../../src/security/mtlsMaterial.js";

describe("netTls helpers", () => {
  it("builds TLS 1.3 mTLS options for server and client", () => {
    const pair = issueSelfSignedMtlsPair();
    const tls = { cert: pair.a.cert, key: pair.a.key, ca: pair.ca.cert };
    const server = buildServerTlsOptions(tls);
    expect(server.minVersion).toBe(NET_TLS_MIN_VERSION);
    expect(server.requestCert).toBe(true);
    expect(server.rejectUnauthorized).toBe(true);
    const loopback = buildClientTlsOptions(tls, { host: "127.0.0.1", port: 8443 });
    expect(loopback.servername).toBe("localhost");
    expect(loopback.rejectUnauthorized).toBe(true);
    const named = buildClientTlsOptions(tls, { host: "peer.example", port: 8443 });
    expect(named.servername).toBe("peer.example");
    const v6 = buildClientTlsOptions(tls, { host: "::1", port: 8443 });
    expect(v6.servername).toBe("localhost");
  });

  it("returns undefined when the socket has no peer certificate", () => {
    const socket = {
      getPeerX509Certificate: () => undefined,
    } as unknown as TLSSocket;
    expect(extractPeerFingerprint(socket)).toBeUndefined();
  });

  it("rejects empty PEM material", () => {
    expect(() => assertTlsMaterial({ cert: "c", key: " ", ca: "ca" })).toThrow("non-empty");
    expect(() => assertTlsMaterial({ cert: "c", key: "k", ca: "" })).toThrow("non-empty");
  });
});
