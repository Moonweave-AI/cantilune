import { describe, expect, it } from "vitest";
import { createRuntimeCommsPorts } from "../../src/integration/runtimeCommsPorts.js";
import { buildCommsRuntimeHarness } from "../support/buildCommsRuntimeHarness.js";
import { actorRef, epochId, epochOrdinal, schemaAdmissionId } from "@cantilune/core";
import type {
  CoordinationRuntime,
  RuntimeEpochAdministration,
  RuntimeViolation,
} from "@cantilune/runtime";

describe("runtimeCommsPorts branches", () => {
  it("maps observe_invalid to invalid_input", async () => {
    const runtime = {
      observe: () => ({ code: "observe_invalid", message: "bad observe" }),
      getHead: () => undefined,
    } as unknown as CoordinationRuntime;
    const ports = createRuntimeCommsPorts({ runtime });
    const result = await ports.observation.observe({
      source: actorRef("human-1" as never, "human"),
      payloadRef: "content://x" as never,
      principal: actorRef("human-1" as never, "human"),
    });
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.error.code).toBe("invalid_input");
  });

  it("maps resource_conflict to stale_binding", async () => {
    const runtime = {
      observe: () => ({ code: "resource_conflict", message: "conflict" }),
      getHead: () => undefined,
    } as unknown as CoordinationRuntime;
    const ports = createRuntimeCommsPorts({ runtime });
    const result = await ports.observation.observe({
      source: actorRef("human-1" as never, "human"),
      payloadRef: "content://x" as never,
      principal: actorRef("human-1" as never, "human"),
    });
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.error.code).toBe("stale_binding");
    expect(result.error.retryable).toBe(true);
  });

  it("maps non-retryable runtime observation failures without weakening them", async () => {
    const runtime = {
      observe: () => ({
        code: "content_ref_unavailable",
        message: "content bytes are not authoritative",
      }),
      getHead: () => undefined,
    } as unknown as CoordinationRuntime;
    const ports = createRuntimeCommsPorts({ runtime });
    const result = await ports.observation.observe({
      source: actorRef("human-1" as never, "human"),
      payloadRef: "content://missing" as never,
      principal: actorRef("human-1" as never, "human"),
    });
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.error.code).toBe("runtime_commit_failed");
    expect(result.error.retryable).toBe(false);
  });

  it("commitMessage rejects when runtime head missing", async () => {
    const runtime = {
      getHead: () => undefined,
      observe: () => ({}),
    } as unknown as CoordinationRuntime;
    const ports = createRuntimeCommsPorts({ runtime });
    const result = await ports.runtimeCommit.commitMessage({
      messageId: "msg-no-head",
      envelopeDigest: "digest",
      snapshotRef: "snap-x" as never,
    });
    expect(result.ok).toBe(false);
  });

  it("commitMessage rejects empty audit tail", async () => {
    const runtime = {
      getHead: () => ({ snapshotRef: "snap-empty" as never, auditTail: [] }),
    } as unknown as CoordinationRuntime;
    const ports = createRuntimeCommsPorts({ runtime });
    const result = await ports.runtimeCommit.commitMessage({
      messageId: "msg-empty-tail",
      envelopeDigest: "digest",
      snapshotRef: "snap-empty" as never,
    });
    expect(result.ok).toBe(false);
  });

  it("commitReconnect succeeds with epoch administration", async () => {
    const harness = buildCommsRuntimeHarness();
    const ports = createRuntimeCommsPorts({
      runtime: harness.runtime,
      epochAdmin: harness.epochAdmin,
    });
    const admissionId = schemaAdmissionId("adm-ports-rc");
    const prepared = await harness.epochAdmin.prepareEpochTransition({
      domainId: harness.binding.activationDomainId,
      admissionId,
      planDigest: "plan-digest" as never,
      expectedHead: harness.runtime.getHead()!.snapshotRef,
      expectedBindingGeneration: harness.binding.bindingGeneration,
      expectedEpochId: harness.binding.epochId,
      expectedEpochOrdinal: harness.binding.epochOrdinal,
      targetEpochId: epochId("43"),
      targetEpochOrdinal: epochOrdinal(2),
      targetSchemaRef: harness.binding.schemaRef,
    });
    expect(prepared.ok).toBe(true);
    if (!prepared.ok) {
      return;
    }
    const committed = await harness.epochAdmin.commitEpochTransition(prepared.value);
    expect(committed.ok).toBe(true);
    if (!committed.ok) {
      return;
    }
    const result = await ports.runtimeCommit.commitReconnect({
      planDigest: "plan-digest",
      admissionId: admissionId as string,
    });
    expect(result.ok).toBe(true);
  });

  it("commitReconnect preserves retryability for replay conflicts", async () => {
    const runtime = {
      getHead: () => undefined,
    } as unknown as CoordinationRuntime;
    const epochAdmin = {
      recoverEpochTransition: async () => ({
        ok: false,
        error: {
          code: "replay_mismatch",
          message: "committed transition is not active",
        } satisfies RuntimeViolation,
      }),
    } as unknown as RuntimeEpochAdministration;
    const ports = createRuntimeCommsPorts({ runtime, epochAdmin });
    const result = await ports.runtimeCommit.commitReconnect({
      planDigest: "plan-digest",
      admissionId: "adm-replay-conflict",
    });
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.error.code).toBe("stale_binding");
    expect(result.error.retryable).toBe(true);
  });
});
