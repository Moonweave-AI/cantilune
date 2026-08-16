import { describe, expect, it } from "vitest";
import { createMemoryRaftKv } from "../../../src/memory/memoryRaftKv.js";
import {
  assertRaftCluster,
  createEtcdStatusQuerier,
  decodeRaftClusterFacts,
  parseRaftEndpoint,
  probeRaftCluster,
  raftConfigured,
  raftRequired,
  readRaftEndpoints,
} from "../../../src/memory/raftHostProbe.js";
import { startEtcdHttpStub, startMemoryEtcdGateway } from "../../support/etcdJsonGateway.js";
import { createMemoryEtcdJsonClient } from "../../support/memoryEtcdJsonClient.js";

describe("raftHostProbe", () => {
  it("parses endpoints and treats blank env as unset", () => {
    expect(parseRaftEndpoint(undefined)).toEqual({
      url: "http://127.0.0.1:2379",
      host: "127.0.0.1",
      port: 2379,
    });
    expect(parseRaftEndpoint("http://etcd.example:2479")).toEqual({
      url: "http://etcd.example:2479",
      host: "etcd.example",
      port: 2479,
    });
    expect(parseRaftEndpoint("not a url")).toEqual({
      url: "http://127.0.0.1:2379",
      host: "127.0.0.1",
      port: 2379,
    });
    expect(readRaftEndpoints({})).toBeUndefined();
    expect(readRaftEndpoints({ CANTILUNE_RAFT_ENDPOINTS: "  " })).toBeUndefined();
    expect(readRaftEndpoints({ CANTILUNE_RAFT_ENDPOINTS: "http://a:2379, http://b:2379" })).toEqual(
      ["http://a:2379", "http://b:2379"],
    );
    expect(raftConfigured({})).toBe(false);
    expect(raftConfigured({ CANTILUNE_RAFT_EMBED: "1" })).toBe(true);
    expect(raftRequired({})).toBe(false);
    expect(raftRequired({ CANTILUNE_REQUIRE_RAFT: "1" })).toBe(true);
  });

  it("fail-closes when endpoints are missing even if TCP is open", async () => {
    const probe = await probeRaftCluster({
      env: {},
      dialer: { connect: async () => true },
    });
    expect(probe.endpointsConfigured).toBe(false);
    expect(probe.ready).toBe(false);
    expect(probe.reason).toMatch(/CANTILUNE_RAFT_ENDPOINTS/);
    expect(() => assertRaftCluster(probe, {})).not.toThrow();
    expect(() => assertRaftCluster(probe, { CANTILUNE_REQUIRE_RAFT: "1" })).toThrow(/fail-closed/);
  });

  it("fail-closes when the listener is closed", async () => {
    const probe = await probeRaftCluster({
      env: { CANTILUNE_RAFT_ENDPOINTS: "http://etcd.example:2379" },
      dialer: { connect: async () => false },
    });
    expect(probe.tcpReachable).toBe(false);
    expect(probe.ready).toBe(false);
  });

  it("accepts a reachable etcd member with a raft term", async () => {
    const probe = await probeRaftCluster({
      env: { CANTILUNE_RAFT_ENDPOINTS: "http://etcd.example:2379" },
      dialer: { connect: async () => true },
      querier: {
        status: async () => ({ raftTerm: "7", clusterId: "abc" }),
      },
    });
    expect(probe.ready).toBe(true);
    expect(probe.raftTerm).toBe("7");
    expect(() => assertRaftCluster(probe, { CANTILUNE_REQUIRE_RAFT: "1" })).not.toThrow();
  });

  it("records a status failure after TCP succeeds", async () => {
    const probe = await probeRaftCluster({
      env: { CANTILUNE_RAFT_EMBED: "1" },
      dialer: { connect: async () => true },
      querier: {
        status: async () => {
          throw new Error("status refused");
        },
      },
    });
    expect(probe.embedRequested).toBe(true);
    expect(probe.ready).toBe(false);
    expect(probe.reason).toBe("status refused");
    expect(decodeRaftClusterFacts({ header: { raft_term: "2", cluster_id: "x" } })).toEqual({
      raftTerm: "2",
      clusterId: "x",
    });
    expect(decodeRaftClusterFacts({ raftTerm: "3", clusterId: "y" })).toEqual({
      raftTerm: "3",
      clusterId: "y",
    });
  });

  it("fail-closes a reachable member with an empty status", async () => {
    const probe = await probeRaftCluster({
      endpoints: ["http://etcd.example:2379"],
      dialer: { connect: async () => true },
      querier: {
        status: async () => ({ raftTerm: "", clusterId: "" }),
      },
    });
    expect(probe.ready).toBe(false);
    expect(probe.reason).toMatch(/raft term/);
    const facts = await createEtcdStatusQuerier(
      createMemoryEtcdJsonClient(createMemoryRaftKv()),
    ).status("http://127.0.0.1:2379");
    expect(facts.raftTerm).toBe("1");
    const gateway = await startMemoryEtcdGateway(createMemoryRaftKv());
    try {
      const live = await createEtcdStatusQuerier().status(gateway.url);
      expect(live.raftTerm).toBe("1");
    } finally {
      gateway.close();
    }
    const stub = await startEtcdHttpStub(() => ({ status: 503, payload: { message: "down" } }));
    try {
      await expect(createEtcdStatusQuerier().status(stub.url)).rejects.toThrow(/etcd status/);
    } finally {
      stub.close();
    }
  });
});
