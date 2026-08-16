/**
 * Bounded reconnect storm: many admission reconnects, no double-commit / leak.
 */
import { describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  correlationId,
  epochId,
  epochOrdinal,
  idempotencyKey,
  occurrenceId,
  operationTemplateRef,
  schemaAdmissionId,
  sessionId,
} from "@cantilune/core";
import {
  buildReconnectPlanFromReceipt,
  createCommsServices,
  executeAdmissionReconnect,
} from "../../../src/engine/createCommsServices.js";
import { testRuntimeCommitPort } from "../../../src/engine/testRuntimeCommitPort.js";
import { channelGeneration, channelId } from "../../../src/foundation/messageId.js";
import type { AdmissionReconnectPlan } from "../../../src/reconnect/admissionReconnectPlan.js";
import type { CommsStore } from "../../../src/ports/commsStore.js";
import type { RuntimeCommitPort } from "../../../src/ports/runtimePorts.js";

const STORM = 16;

const binding = {
  activationDomainId: "default" as never,
  bindingGeneration: 2 as never,
  epochId: "43" as never,
  epochOrdinal: 2 as never,
  schemaRef: { schemaId: "default-v1", revisionId: "rev-002", digest: "abc" as never } as never,
  policyRef: { policyId: "p", revisionId: "1", digest: "d" as never } as never,
  handlerManifestRef: { manifestId: "m", digest: "d" as never } as never,
  runtimeHead: "snap-E2" as never,
  admissionId: "adm-001" as never,
  activatedBy: "operator",
  activatedAt: "2026-08-11T15:00:00Z",
} as const;

function registerSessionBinding(store: CommsStore, plan: AdmissionReconnectPlan): void {
  store.casSessionBinding({
    sessionId: plan.sessionId,
    expectedGeneration: channelGeneration(0),
    next: {
      sessionId: plan.sessionId,
      authoritativeSnapshotRef: plan.expectedRuntimeHead,
      localRuntimeInstanceId: "runtime-local" as never,
      remoteRuntimeInstanceId: "runtime-remote" as never,
      channelId: channelId(`channel-${plan.sessionId as string}`),
      channelGeneration: plan.expectedChannelGeneration,
      localEndpoint: plan.oldEndpointRef,
      remoteEndpoint: plan.newEndpointRef,
      negotiated: {
        wireVersion: 1 as never,
        transport: "loopback",
        codecRef: "comms/wire-v1",
        protocolVersion: "comms/1",
        a2aProfile: "a2a/0.1",
        features: [],
      },
      schemaEpochId: String(plan.toBinding.epochId),
      status: "active",
      outboundSequence: 0,
      inboundSequence: 0,
      establishedAt: "2026-08-11T16:00:00Z",
      updatedAt: "2026-08-11T16:00:00Z",
    },
  });
}

function countingCommitPort(): { port: RuntimeCommitPort; commits: { count: number } } {
  const inner = testRuntimeCommitPort();
  const commits = { count: 0 };
  return {
    commits,
    port: {
      async commitReconnect(input) {
        commits.count += 1;
        return inner.commitReconnect(input);
      },
      commitMessage: inner.commitMessage,
    },
  };
}

describe("reconnect storm soak", () => {
  it("commits each unique reconnect once and rejects replay without leaking", async () => {
    const dir = mkdtempSync(join(tmpdir(), "cantilune-reconnect-storm-"));
    const counted = countingCommitPort();
    try {
      const services = createCommsServices({
        mode: "test",
        storeDir: dir,
        bindingResolver: { getActiveBinding: () => binding },
        sessionAuthority: { isController: () => true, isMember: () => true },
        runtimeCommit: counted.port,
        quiescence: { resourcesClear: async () => true, sessionsQuiescent: async () => true },
        clock: { now: () => "2026-08-11T16:00:00Z" },
      });

      const plans: AdmissionReconnectPlan[] = [];
      for (let index = 0; index < STORM; index += 1) {
        const receipt = {
          admissionId: schemaAdmissionId(`adm-storm-${index}`),
          activationDomainId: "default" as never,
          fromBinding: binding,
          toBinding: { ...binding },
          beforeSnapshotRef: "snap-E1" as never,
          afterSnapshotRef: "snap-E2" as never,
          extensionPlanRef: "plan-ref",
          admissionTombstoneId: `tomb-storm-${index}` as never,
          committedBy: "operator",
          committedAt: "2026-08-11T15:00:00Z",
          storeSequence: index as never,
          correlationId: correlationId(`corr-storm-${index}`),
          occurrenceId: occurrenceId(`occ-storm-${index}`),
          idempotencyKey: idempotencyKey(`idem-storm-${index}`),
          planDigest: "plan-digest" as never,
          authorizationEvidenceRef: "auth-storm" as never,
        };
        const plan = buildReconnectPlanFromReceipt({
          resolver: services.receiptResolver,
          receipt,
          sessionId: sessionId(`session-storm-${index}`),
          operationTemplateRef: operationTemplateRef("introduce", "1"),
        });
        expect(plan.ok).toBe(true);
        if (!plan.ok) return;
        registerSessionBinding(services.store, plan.value);
        const committed = await executeAdmissionReconnect({ services, plan: plan.value });
        expect(committed.ok).toBe(true);
        plans.push(plan.value);
      }

      expect(counted.commits.count).toBe(STORM);
      expect(services.store.snapshot().occurrences).toHaveLength(STORM);
      const committedEvents = services.store
        .snapshot()
        .events.filter((event) => event.kind === "ReconnectCommitted");
      expect(committedEvents).toHaveLength(STORM);

      for (const plan of plans) {
        const recovered = await services.reconnect.recover(plan.planId);
        expect(recovered.ok).toBe(true);
        const replay = await executeAdmissionReconnect({ services, plan });
        expect(replay.ok).toBe(false);
      }

      expect(counted.commits.count).toBe(STORM);
      expect(services.store.snapshot().occurrences).toHaveLength(STORM);
      expect(services.admin.isFrozen()).toBe(false);
      expect(services.store.snapshot().reconnects.size).toBe(STORM);

      const reloaded = createCommsServices({
        mode: "test",
        storeDir: dir,
        bindingResolver: { getActiveBinding: () => binding },
        sessionAuthority: { isController: () => true, isMember: () => true },
        runtimeCommit: testRuntimeCommitPort(),
        quiescence: { resourcesClear: async () => true, sessionsQuiescent: async () => true },
      });
      expect(reloaded.store.snapshot().occurrences).toHaveLength(STORM);
      expect(reloaded.store.snapshot().reconnects.size).toBe(STORM);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
