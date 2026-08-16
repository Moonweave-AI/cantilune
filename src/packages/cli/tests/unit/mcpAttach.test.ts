import { describe, expect, it, vi } from "vitest";
import {
  activationDomainId,
  admissionTombstoneId,
  bindingGeneration,
  contentDigest,
  correlationId,
  epochId,
  epochOrdinal,
  handlerManifestDigest,
  handlerManifestId,
  handlerManifestRef,
  idempotencyKey,
  occurrenceId,
  planDigest,
  policyId,
  policyRef,
  policyRevisionId,
  schemaAdmissionId,
  schemaDigest,
  schemaId,
  schemaRevisionId,
  snapshotRef,
  storeSequence,
  type SchemaAdmissionReceipt,
} from "@cantilune/core";
import type { ToolSet } from "@cantilune/tools";
import { createStore } from "../../src/store.js";
import {
  applyPendingMcpAttach,
  currentMcpEpoch,
  pendingServersToConfigs,
  scheduleMcpAttach,
} from "../../src/wiring/mcpAttach.js";

function receipt(): SchemaAdmissionReceipt {
  const binding = {
    activationDomainId: activationDomainId("default"),
    bindingGeneration: bindingGeneration(1),
    epochId: epochId("epoch-1"),
    epochOrdinal: epochOrdinal(1),
    schemaRef: {
      schemaId: schemaId("default-v1"),
      revisionId: schemaRevisionId("rev-001"),
      digest: schemaDigest("d1"),
    },
    policyRef: policyRef(policyId("p1"), policyRevisionId("pr1"), contentDigest("pd1")),
    handlerManifestRef: handlerManifestRef(handlerManifestId("h1"), handlerManifestDigest("hd1")),
    runtimeHead: snapshotRef("snap-S0"),
    admissionId: schemaAdmissionId("bootstrap"),
    activatedBy: "bootstrap",
    activatedAt: "2026-08-15T00:00:00Z",
  };
  return {
    admissionId: schemaAdmissionId("adm-mcp-1"),
    activationDomainId: activationDomainId("default"),
    fromBinding: binding,
    toBinding: { ...binding, epochId: epochId("epoch-2"), epochOrdinal: epochOrdinal(2) },
    beforeSnapshotRef: snapshotRef("snap-S0"),
    afterSnapshotRef: snapshotRef("snap-E1"),
    extensionPlanRef: "plan-ref-1",
    admissionTombstoneId: admissionTombstoneId("tomb-1"),
    committedBy: "test",
    committedAt: "2026-08-15T00:00:00Z",
    storeSequence: storeSequence(1),
    correlationId: correlationId("corr-1"),
    occurrenceId: occurrenceId("occ-1"),
    idempotencyKey: idempotencyKey("idem-1"),
    planDigest: planDigest("pd-1"),
  };
}

describe("scheduleMcpAttach", () => {
  it("flags pendingToolSurface without applying tools", async () => {
    const store = createStore({
      runtime: {
        snapshot: null,
        changeLog: [],
        epoch: { epochId: "epoch-1", ordinal: 1, schemaId: "default" },
      },
    });
    const pending = await scheduleMcpAttach({
      store,
      action: "connect",
      servers: ["docs=npx server"],
    });
    expect(pending.currentEpoch).toBe("epoch-1");
    expect(store.pendingToolSurface?.servers).toEqual(["docs=npx server"]);
  });

  it("stores a tool-surface receipt from commitToolSurfaceEpoch", async () => {
    const store = createStore({
      runtime: {
        snapshot: null,
        changeLog: [],
        epoch: { epochId: "epoch-1", ordinal: 1, schemaId: "default" },
      },
    });
    const committed = receipt();
    const pending = await scheduleMcpAttach({
      store,
      action: "connect",
      servers: ["docs=npx server"],
      services: {
        controlPlane: () =>
          ({
            commitToolSurfaceEpoch: () => ({
              ok: true,
              message: "committed",
              admissionId: committed.admissionId as string,
              receipt: committed,
            }),
          }) as never,
      },
    });
    expect(pending.admissionReceipt).toEqual(committed);
    expect(pending.currentEpoch).toBe(String(committed.fromBinding.epochId));
  });

  it("records a warn when schema admission is refused", async () => {
    const store = createStore();
    const notify = vi.fn();
    await scheduleMcpAttach({
      store,
      action: "connect",
      servers: ["docs=npx server"],
      services: {
        notify,
        controlPlane: () =>
          ({
            admitCandidate: async () => ({ ok: false, message: "not monotone" }),
            genesisBinding: { epochId: "boot" },
          }) as never,
      },
    });
    expect(notify).toHaveBeenCalledWith("warn", expect.stringContaining("not monotone"));
    expect(store.pendingToolSurface?.admissionId).toBeUndefined();
  });
});

describe("applyPendingMcpAttach", () => {
  it("does nothing without a pending surface or receipt", () => {
    const store = createStore();
    const toolSet = { applyMcpSurface: vi.fn() } as unknown as ToolSet;
    expect(applyPendingMcpAttach({ store, toolSet }).applied).toBe(false);

    store.pendingToolSurface = {
      action: "connect",
      servers: ["docs=npx server"],
      currentEpoch: "epoch-1",
    };
    expect(applyPendingMcpAttach({ store, toolSet }).reason).toMatch(/receipt required/);
    expect(toolSet.applyMcpSurface).not.toHaveBeenCalled();
  });

  it("applies the next surface when a receipt is present", () => {
    const store = createStore();
    store.pendingToolSurface = {
      action: "connect",
      servers: ["docs=npx -y server"],
      currentEpoch: "epoch-1",
      admissionReceipt: receipt(),
    };
    const toolSet = {
      applyMcpSurface: vi.fn(() => ({
        epochId: "epoch-2",
        admissionId: "adm-mcp-1",
        servers: [{ name: "docs", command: "npx" }],
      })),
    } as unknown as ToolSet;
    const result = applyPendingMcpAttach({ store, toolSet });
    expect(result.applied).toBe(true);
    expect(store.pendingToolSurface).toBeNull();
    expect(toolSet.applyMcpSurface).toHaveBeenCalledWith(
      expect.objectContaining({
        currentEpoch: "epoch-1",
        servers: [{ name: "docs", command: "npx", args: ["-y", "server"] }],
      }),
    );
  });

  it("resolves a committed receipt from control-plane", () => {
    const store = createStore();
    store.pendingToolSurface = {
      action: "connect",
      servers: ["docs=npx server"],
      currentEpoch: "epoch-1",
      admissionId: "adm-mcp-1",
    };
    const toolSet = { applyMcpSurface: vi.fn() } as unknown as ToolSet;
    applyPendingMcpAttach({
      store,
      toolSet,
      services: {
        controlPlane: () =>
          ({
            getCommitReceipt: () => receipt(),
          }) as never,
      },
    });
    expect(toolSet.applyMcpSurface).toHaveBeenCalled();
  });

  it("returns the attach error when applyMcpSurface throws", () => {
    const store = createStore();
    store.pendingToolSurface = {
      action: "connect",
      servers: ["docs=npx server"],
      currentEpoch: "epoch-1",
      admissionReceipt: receipt(),
    };
    const toolSet = {
      applyMcpSurface: () => {
        throw new Error("epoch mismatch");
      },
    } as unknown as ToolSet;
    expect(applyPendingMcpAttach({ store, toolSet }).reason).toBe("epoch mismatch");
  });

  it("stringifies non-Error apply failures", () => {
    const store = createStore();
    store.pendingToolSurface = {
      action: "connect",
      servers: ["docs=npx server"],
      currentEpoch: "epoch-1",
      admissionReceipt: receipt(),
    };
    const toolSet = {
      applyMcpSurface: () => {
        throw "plain";
      },
    } as unknown as ToolSet;
    expect(applyPendingMcpAttach({ store, toolSet }).reason).toBe("plain");
  });
});

describe("mcp attach helpers", () => {
  it("reads the current epoch from the live runtime or genesis binding", () => {
    const store = createStore();
    expect(currentMcpEpoch(store)).toBe("unknown");
    expect(
      currentMcpEpoch(store, {
        controlPlane: () => ({ genesisBinding: { epochId: "boot-epoch" } }) as never,
      }),
    ).toBe("boot-epoch");
  });

  it("drops rejected HTTP specs from the attach surface", () => {
    expect(pendingServersToConfigs(["https://mcp.example", "docs=npx server"])).toEqual([
      { name: "docs", command: "npx", args: ["server"] },
    ]);
  });
});
