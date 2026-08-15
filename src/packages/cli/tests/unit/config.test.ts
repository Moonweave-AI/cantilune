import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, readFile, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { actorId, collaborationSnapshot, epochId, participant, snapshotRef } from "@cantilune/core";
import { createFileRuntimePersistence } from "@cantilune/runtime/memory";
import {
  DEFAULT_CONFIG,
  createCliPrincipalId,
  ensureCliPrincipal,
  configDir,
  configPath,
  loadConfig,
  parseConfig,
  saveConfig,
  updateConfig,
} from "../../src/config.js";

let dir: string;
let file: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "cantilune-config-"));
  file = join(dir, "config.json");
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("config paths", () => {
  it("puts the config under a dotted home directory", () => {
    expect(configDir()).toContain(".cantilune");
    expect(configPath()).toBe(join(configDir(), "config.json"));
  });
});

describe("parseConfig", () => {
  it("falls back to defaults for non-object input", () => {
    expect(parseConfig(null)).toBe(DEFAULT_CONFIG);
    expect(parseConfig("nope")).toBe(DEFAULT_CONFIG);
    expect(parseConfig([])).toBe(DEFAULT_CONFIG);
  });

  it("keeps recognized fields and drops the rest", () => {
    const parsed = parseConfig({
      provider: "dashscope",
      model: "qwen-max",
      baseUrl: "https://example.test/v1",
      layout: "observe",
      theme: "daylight",
      durable: "file",
      storagePath: "./.cantilune",
      maxTurns: 25,
      principalId: "cli-stable",
      compatibleEpochIds: ["boot-epoch-3dd1b913", "boot-epoch-3dd1b913"],
      secretApiKey: "sk-should-be-dropped",
    });

    expect(parsed).toEqual({
      provider: "dashscope",
      model: "qwen-max",
      baseUrl: "https://example.test/v1",
      layout: "observe",
      theme: "daylight",
      durable: "file",
      storagePath: "./.cantilune",
      maxTurns: 25,
      principalId: "cli-stable",
      compatibleEpochIds: ["boot-epoch-3dd1b913"],
    });
  });

  it("substitutes defaults for missing or empty strings", () => {
    const parsed = parseConfig({ provider: "", model: undefined });
    expect(parsed.provider).toBe(DEFAULT_CONFIG.provider);
    expect(parsed.model).toBe(DEFAULT_CONFIG.model);
  });

  it("normalises unrecognized layout and durable values", () => {
    const parsed = parseConfig({ layout: "split", durable: "redis" });
    expect(parsed.layout).toBe("focus");
    expect(parsed.durable).toBe("file");
  });

  it("drops a theme that is not a known palette", () => {
    expect(parseConfig({ theme: "solarized" })).not.toHaveProperty("theme");
    expect(parseConfig({ theme: 7 })).not.toHaveProperty("theme");
  });

  it("drops a non-finite maxTurns", () => {
    expect(parseConfig({ maxTurns: Number.NaN })).not.toHaveProperty("maxTurns");
    expect(parseConfig({ maxTurns: "40" })).not.toHaveProperty("maxTurns");
  });

  it("drops a partially invalid epoch compatibility list", () => {
    expect(parseConfig({ compatibleEpochIds: ["boot-epoch-1", 7] })).not.toHaveProperty(
      "compatibleEpochIds",
    );
  });
});

describe("CLI principal", () => {
  it("generates a namespaced actor id", () => {
    expect(createCliPrincipalId()).toMatch(/^cli-[0-9a-f]{8}$/);
  });

  it("persists a principal exactly once", async () => {
    const storagePath = join(dir, "new-world");
    const first = await ensureCliPrincipal({ ...DEFAULT_CONFIG, storagePath }, file);
    const second = await ensureCliPrincipal(first, file);

    expect(first.principalId).toMatch(/^cli-/);
    expect(second.principalId).toBe(first.principalId);
    await expect(loadConfig(file)).resolves.toMatchObject({ principalId: first.principalId });
    const persisted = createFileRuntimePersistence({ dir: join(storagePath, "runtime") });
    const head = persisted.durable.head();
    expect(
      head === undefined
        ? undefined
        : persisted.durable.get(head)?.participants.has(actorId(first.principalId!)),
    ).toBe(true);
  });

  it("fails closed when an explicit configured principal disagrees with the durable winner", async () => {
    const storagePath = join(dir, "winner-world");
    const winner = actorId("winner-agent");
    createFileRuntimePersistence({
      dir: join(storagePath, "runtime"),
      initial: collaborationSnapshot({
        snapshotRef: snapshotRef("winner-genesis"),
        epochId: epochId("boot-epoch-1"),
        participants: new Map([[winner, participant(winner, "agent")]]),
      }),
    });

    await expect(
      ensureCliPrincipal({ ...DEFAULT_CONFIG, storagePath, principalId: "stale-loser" }, file),
    ).rejects.toThrow("is not an active Agent in the durable world");
  });

  it("resumes an explicitly configured active principal in a multi-Agent world", async () => {
    const storagePath = join(dir, "swarm-world");
    const configured = actorId("configured-agent");
    const peer = actorId("peer-agent");
    createFileRuntimePersistence({
      dir: join(storagePath, "runtime"),
      initial: collaborationSnapshot({
        snapshotRef: snapshotRef("swarm-genesis"),
        epochId: epochId("boot-epoch-1"),
        participants: new Map([
          [configured, participant(configured, "agent")],
          [peer, participant(peer, "agent")],
        ]),
      }),
    });
    const config = { ...DEFAULT_CONFIG, storagePath, principalId: String(configured) };

    await expect(ensureCliPrincipal(config, file)).resolves.toEqual(config);
  });

  it("adopts the only active Agent from a legacy file world before minting an identity", async () => {
    const storagePath = join(dir, "legacy-world");
    const legacyId = actorId("boot-06864291");
    createFileRuntimePersistence({
      dir: join(storagePath, "runtime"),
      initial: collaborationSnapshot({
        snapshotRef: snapshotRef("legacy-head"),
        epochId: epochId("boot-epoch-3dd1b913"),
        participants: new Map([[legacyId, participant(legacyId, "agent")]]),
      }),
    });

    const adopted = await ensureCliPrincipal(
      { ...DEFAULT_CONFIG, storagePath, compatibleEpochIds: ["boot-epoch-3dd1b913"] },
      file,
    );

    expect(adopted.principalId).toBe("boot-06864291");
    await expect(loadConfig(file)).resolves.toMatchObject({ principalId: "boot-06864291" });
  });

  it("fails closed when a legacy file world has ambiguous active Agents", async () => {
    const storagePath = join(dir, "ambiguous-world");
    const first = actorId("first-agent");
    const second = actorId("second-agent");
    createFileRuntimePersistence({
      dir: join(storagePath, "runtime"),
      initial: collaborationSnapshot({
        snapshotRef: snapshotRef("ambiguous-head"),
        epochId: epochId("boot-epoch-1"),
        participants: new Map([
          [first, participant(first, "agent")],
          [second, participant(second, "agent")],
        ]),
      }),
    });

    await expect(ensureCliPrincipal({ ...DEFAULT_CONFIG, storagePath }, file)).rejects.toThrow(
      "does not contain exactly one active Agent",
    );
  });
});

describe("loadConfig", () => {
  it("returns defaults when the file does not exist", async () => {
    await expect(loadConfig(join(dir, "missing.json"))).resolves.toBe(DEFAULT_CONFIG);
  });

  it("returns defaults rather than throwing on corrupt JSON", async () => {
    await writeFile(file, "{ not json", "utf-8");
    await expect(loadConfig(file)).resolves.toBe(DEFAULT_CONFIG);
  });

  it("reads a previously written config", async () => {
    await saveConfig({ provider: "anthropic", model: "claude-opus-4-20250514" }, file);
    const loaded = await loadConfig(file);
    expect(loaded.provider).toBe("anthropic");
    expect(loaded.model).toBe("claude-opus-4-20250514");
  });
});

describe("saveConfig", () => {
  it("creates the directory tree on the way", async () => {
    const nested = join(dir, "a", "b", "config.json");
    await saveConfig(DEFAULT_CONFIG, nested);
    await expect(readFile(nested, "utf-8")).resolves.toContain('"provider"');
  });

  it("writes pretty-printed JSON with a trailing newline", async () => {
    await saveConfig(DEFAULT_CONFIG, file);
    const text = await readFile(file, "utf-8");
    expect(text.endsWith("\n")).toBe(true);
    expect(text).toContain("\n  ");
  });
});

describe("updateConfig", () => {
  it("merges a patch into the existing file", async () => {
    await saveConfig({ provider: "openai", model: "gpt-4o", layout: "focus" }, file);
    const next = await updateConfig({ model: "o3", theme: "mono" }, file);

    expect(next.provider).toBe("openai");
    expect(next.model).toBe("o3");
    expect(next.theme).toBe("mono");
    await expect(loadConfig(file)).resolves.toMatchObject({ model: "o3", theme: "mono" });
  });

  it("starts from defaults when there is nothing on disk yet", async () => {
    await mkdir(dir, { recursive: true });
    const next = await updateConfig({ provider: "groq" }, file);
    expect(next.provider).toBe("groq");
    expect(next.model).toBe(DEFAULT_CONFIG.model);
  });
});
