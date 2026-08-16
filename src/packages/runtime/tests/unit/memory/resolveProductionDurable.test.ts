import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { buildConfigT0 } from "@cantilune/test-fixtures";
import { createMemoryRaftKv } from "../../../src/memory/memoryRaftKv.js";
import { resolveProductionDurable } from "../../../src/memory/resolveProductionDurable.js";
import { createMemorySqlHarness } from "../../support/memorySqlExecutor.js";

const dirs: string[] = [];

afterEach(() => {
  for (const dir of dirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

function tempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "cantilune-durable-"));
  dirs.push(dir);
  return dir;
}

describe("resolveProductionDurable", () => {
  it("uses file durable when no database URL is set", () => {
    const resolved = resolveProductionDurable({
      storagePath: tempDir(),
      initial: buildConfigT0(),
      env: {},
    });
    expect(resolved.backend).toBe("file");
    expect(resolved.durable.head()).toBe(buildConfigT0().snapshotRef);
  });

  it("fail-closes multi-host production without Postgres or Raft", () => {
    expect(() =>
      resolveProductionDurable({
        storagePath: tempDir(),
        initial: buildConfigT0(),
        env: { CANTILUNE_HOST_MODE: "multi" },
      }),
    ).toThrow(/CANTILUNE_DURABLE_DATABASE_URL|CANTILUNE_RAFT/);
  });

  it("fail-closes forced Postgres or Raft when that backend is missing", () => {
    expect(() =>
      resolveProductionDurable({
        storagePath: tempDir(),
        initial: buildConfigT0(),
        env: { CANTILUNE_REQUIRE_POSTGRES_HA: "1" },
      }),
    ).toThrow(/CANTILUNE_DURABLE_DATABASE_URL/);
    expect(() =>
      resolveProductionDurable({
        storagePath: tempDir(),
        initial: buildConfigT0(),
        env: { CANTILUNE_REQUIRE_RAFT: "1" },
      }),
    ).toThrow(/CANTILUNE_RAFT/);
    expect(() =>
      resolveProductionDurable({
        storagePath: tempDir(),
        initial: buildConfigT0(),
        env: { CANTILUNE_REQUIRE_POSTGRES_HA: "1", CANTILUNE_REQUIRE_RAFT: "1" },
      }),
    ).toThrow(/cannot both be set/);
  });

  it("selects Raft when endpoints are set", () => {
    const resolved = resolveProductionDurable({
      storagePath: tempDir(),
      initial: buildConfigT0(),
      env: { CANTILUNE_RAFT_ENDPOINTS: "http://127.0.0.1:2379" },
      raftKv: createMemoryRaftKv(),
    });
    expect(resolved.backend).toBe("raft");
    expect(resolved.durable.head()).toBe(buildConfigT0().snapshotRef);
    resolved.dispose?.();
  });

  it("prefers Raft when REQUIRE_RAFT is set even if a database URL is present", () => {
    const resolved = resolveProductionDurable({
      storagePath: tempDir(),
      initial: buildConfigT0(),
      env: {
        CANTILUNE_REQUIRE_RAFT: "1",
        CANTILUNE_RAFT_ENDPOINTS: "http://127.0.0.1:2379",
        CANTILUNE_DURABLE_DATABASE_URL: "postgres://cantilune/test",
      },
      raftKv: createMemoryRaftKv(),
    });
    expect(resolved.backend).toBe("raft");
    resolved.dispose?.();
  });

  it("selects Postgres when the URL is set", () => {
    const harness = createMemorySqlHarness();
    const resolved = resolveProductionDurable({
      storagePath: tempDir(),
      initial: buildConfigT0(),
      env: { CANTILUNE_DURABLE_DATABASE_URL: "postgres://cantilune/test" },
      executor: harness.executor,
    });
    expect(resolved.backend).toBe("postgres");
    expect(resolved.durable.head()).toBe(buildConfigT0().snapshotRef);
    expect(typeof resolved.dispose).toBe("function");
    resolved.dispose?.();
  });

  it("pins file durable even when the host env advertises Postgres or Raft", () => {
    const resolved = resolveProductionDurable({
      storagePath: tempDir(),
      initial: buildConfigT0(),
      env: {
        CANTILUNE_DURABLE_BACKEND: "file",
        CANTILUNE_DURABLE_DATABASE_URL: "postgres://cantilune/test",
        CANTILUNE_RAFT_ENDPOINTS: "http://127.0.0.1:2379",
      },
    });
    expect(resolved.backend).toBe("file");
    expect(resolved.durable.head()).toBe(buildConfigT0().snapshotRef);
  });

  it("fail-closes a file pin that also requires HA", () => {
    expect(() =>
      resolveProductionDurable({
        storagePath: tempDir(),
        initial: buildConfigT0(),
        env: { CANTILUNE_DURABLE_BACKEND: "file", CANTILUNE_REQUIRE_POSTGRES_HA: "1" },
      }),
    ).toThrow(/conflicts/);
  });

  it("pins Postgres or Raft when requested and fail-closes a pin without its backend", () => {
    const harness = createMemorySqlHarness();
    const postgres = resolveProductionDurable({
      storagePath: tempDir(),
      initial: buildConfigT0(),
      env: {
        CANTILUNE_DURABLE_BACKEND: "postgres",
        CANTILUNE_DURABLE_DATABASE_URL: "postgres://cantilune/test",
      },
      executor: harness.executor,
    });
    expect(postgres.backend).toBe("postgres");
    postgres.dispose?.();
    const raft = resolveProductionDurable({
      storagePath: tempDir(),
      initial: buildConfigT0(),
      env: { CANTILUNE_DURABLE_BACKEND: "raft" },
      raftKv: createMemoryRaftKv(),
    });
    expect(raft.backend).toBe("raft");
    raft.dispose?.();
    expect(() =>
      resolveProductionDurable({
        storagePath: tempDir(),
        initial: buildConfigT0(),
        env: { CANTILUNE_DURABLE_BACKEND: "postgres" },
      }),
    ).toThrow(/CANTILUNE_DURABLE_DATABASE_URL/);
    expect(() =>
      resolveProductionDurable({
        storagePath: tempDir(),
        initial: buildConfigT0(),
        env: { CANTILUNE_DURABLE_BACKEND: "raft" },
      }),
    ).toThrow(/CANTILUNE_RAFT/);
  });
});
