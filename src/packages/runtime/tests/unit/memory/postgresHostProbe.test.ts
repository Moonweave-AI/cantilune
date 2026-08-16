import { describe, expect, it } from "vitest";
import net from "node:net";
import {
  asBoolean,
  scalarString,
  assertPostgresHa,
  createTcpDialer,
  decodePostgresHaFacts,
  firstRowValue,
  parsePostgresEndpoint,
  postgresHaFactsReady,
  postgresHaRequired,
  probePostgresHa,
  readDurableDatabaseUrl,
} from "../../../src/memory/postgresHostProbe.js";

describe("postgresHostProbe", () => {
  it("parses postgres URLs and treats blank env as unset", () => {
    expect(parsePostgresEndpoint(undefined)).toEqual({ host: "127.0.0.1", port: 5432 });
    expect(parsePostgresEndpoint("postgres://db.example:6543/cantilune")).toEqual({
      host: "db.example",
      port: 6543,
    });
    expect(parsePostgresEndpoint("not a url")).toEqual({ host: "127.0.0.1", port: 5432 });
    expect(readDurableDatabaseUrl({})).toBeUndefined();
    expect(readDurableDatabaseUrl({ CANTILUNE_DURABLE_DATABASE_URL: "  " })).toBeUndefined();
    expect(readDurableDatabaseUrl({ CANTILUNE_DURABLE_DATABASE_URL: "postgres://x" })).toBe(
      "postgres://x",
    );
  });

  it("requires HA only for multi-host or explicit flags", () => {
    expect(postgresHaRequired({})).toBe(false);
    expect(postgresHaRequired({ CANTILUNE_HOST_MODE: "multi" })).toBe(false);
    expect(postgresHaRequired({ CANTILUNE_REQUIRE_POSTGRES_HA: "1" })).toBe(true);
    expect(
      postgresHaFactsReady({ inRecovery: false, replicaCount: 0, synchronousStandbyNames: "" }),
    ).toBe(false);
    expect(
      postgresHaFactsReady({ inRecovery: true, replicaCount: 0, synchronousStandbyNames: "" }),
    ).toBe(true);
    expect(
      postgresHaFactsReady({ inRecovery: false, replicaCount: 1, synchronousStandbyNames: "" }),
    ).toBe(true);
    expect(
      postgresHaFactsReady({
        inRecovery: false,
        replicaCount: 0,
        synchronousStandbyNames: "standby1",
      }),
    ).toBe(true);
  });

  it("fail-closes when the URL is missing even if TCP is open", async () => {
    const probe = await probePostgresHa({
      env: {},
      dialer: { connect: async () => true },
    });
    expect(probe.urlConfigured).toBe(false);
    expect(probe.tcpReachable).toBe(true);
    expect(probe.haReady).toBe(false);
    expect(probe.reason).toMatch(/CANTILUNE_DURABLE_DATABASE_URL/);
    expect(() => assertPostgresHa(probe, {})).not.toThrow();
    expect(() => assertPostgresHa(probe, { CANTILUNE_REQUIRE_POSTGRES_HA: "1" })).toThrow(
      /fail-closed/,
    );
  });

  it("fail-closes when the listener is closed", async () => {
    const probe = await probePostgresHa({
      env: { CANTILUNE_DURABLE_DATABASE_URL: "postgres://ha.example:5432/cantilune" },
      dialer: { connect: async () => false },
    });
    expect(probe.host).toBe("ha.example");
    expect(probe.tcpReachable).toBe(false);
    expect(probe.haReady).toBe(false);
  });

  it("accepts a reachable primary with a streaming replica", async () => {
    const probe = await probePostgresHa({
      env: { CANTILUNE_DURABLE_DATABASE_URL: "postgresql://ha.example:5432/cantilune" },
      dialer: { connect: async () => true },
      querier: {
        query: async () => ({
          inRecovery: false,
          replicaCount: 1,
          synchronousStandbyNames: "",
        }),
      },
    });
    expect(probe.haReady).toBe(true);
    expect(probe.replicaCount).toBe(1);
    expect(() => assertPostgresHa(probe, { CANTILUNE_REQUIRE_POSTGRES_HA: "1" })).not.toThrow();
  });

  it("fail-closes a lone primary with no replica catalog", async () => {
    const probe = await probePostgresHa({
      connectionString: "postgres://solo.example/cantilune",
      dialer: { connect: async () => true },
      querier: {
        query: async () => ({
          inRecovery: false,
          replicaCount: 0,
          synchronousStandbyNames: "",
        }),
      },
    });
    expect(probe.haReady).toBe(false);
    expect(probe.reason).toMatch(/HA catalog/);
  });

  it("dials a closed local port as unreachable and an ephemeral listener as open", async () => {
    const reachable = await createTcpDialer().connect("127.0.0.1", 1, 400);
    expect(reachable).toBe(false);
    const listener = net.createServer();
    const port = await new Promise<number>((resolve) => {
      listener.listen(0, "127.0.0.1", () => {
        const address = listener.address();
        resolve(typeof address === "object" && address !== null ? address.port : 0);
      });
    });
    try {
      expect(await createTcpDialer().connect("127.0.0.1", port, 800)).toBe(true);
    } finally {
      await new Promise<void>((resolve, reject) => {
        listener.close((error) => (error !== undefined ? reject(error) : resolve()));
      });
    }
  });

  it("decodes HA catalog rows including fallback columns", () => {
    expect(asBoolean(true)).toBe(true);
    expect(asBoolean("t")).toBe(true);
    expect(asBoolean("true")).toBe(true);
    expect(asBoolean("f")).toBe(false);
    expect(scalarString("standby")).toBe("standby");
    expect(scalarString(3)).toBe("3");
    expect(scalarString(true)).toBe("true");
    expect(scalarString({})).toBe("");
    expect(firstRowValue([], "in_recovery")).toBeUndefined();
    expect(firstRowValue([{ other: "standby1" }], "synchronous_standby_names")).toBe("standby1");
    expect(
      decodePostgresHaFacts({
        recoveryRows: [{ in_recovery: "t" }],
        replicaRows: [{ replica_count: 2 }],
        syncRows: [{ synchronous_standby_names: "*" }],
      }),
    ).toEqual({
      inRecovery: true,
      replicaCount: 2,
      synchronousStandbyNames: "*",
    });
  });

  it("records a query failure after TCP succeeds", async () => {
    const probe = await probePostgresHa({
      env: { CANTILUNE_DURABLE_DATABASE_URL: "postgres://ha.example/cantilune" },
      dialer: { connect: async () => true },
      querier: {
        query: async () => {
          throw new Error("catalog refused");
        },
      },
    });
    expect(probe.tcpReachable).toBe(true);
    expect(probe.haReady).toBe(false);
    expect(probe.reason).toBe("catalog refused");
  });
});
