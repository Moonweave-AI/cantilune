import { type Result, err, ok, planDigest, emptyFootprint } from "@cantilune/core";
import { commsViolation, type CommsViolation } from "../foundation/commsViolation.js";
import {
  type AdmissionReconnectPlan,
  type AdmissionReconnectReceipt,
  type ReconnectCoordinatorRecord,
} from "./admissionReconnectPlan.js";
import { type CommsStore } from "../ports/commsStore.js";
import {
  type ActiveBindingResolver,
  type RuntimeCommitPort,
  type EventSink,
  type Clock,
} from "../ports/runtimePorts.js";
import { type EStopGate } from "../security/identityVerifier.js";
import { type CommsEventEnvelope } from "../events/commsEvent.js";
import { commsEventId, channelGeneration, descriptorRef } from "../foundation/messageId.js";
import { boundOutputAction } from "../protocol/nativeCommunicationAction.js";
import { resolveOperationBinding } from "../protocol/communicationOperationRegistry.js";
import { type CommunicationOccurrenceRecord } from "../protocol/communicationOccurrenceRecord.js";

export interface ReconnectCoordinatorDeps {
  readonly store: CommsStore;
  readonly bindingResolver: ActiveBindingResolver;
  readonly runtimeCommit: RuntimeCommitPort;
  readonly events: EventSink;
  readonly clock: Clock;
  readonly eStop: EStopGate;
}

export class ReconnectCoordinator {
  constructor(private readonly deps: ReconnectCoordinatorDeps) {}

  async propose(
    plan: AdmissionReconnectPlan,
  ): Promise<Result<ReconnectCoordinatorRecord, CommsViolation>> {
    if (this.deps.eStop.isFrozen()) {
      return err(commsViolation("comms_frozen", "reconnect", "comms E-Stop active"));
    }
    const now = Date.parse(this.deps.clock.now());
    const expires = Date.parse(plan.expiresAt);
    if (!Number.isNaN(now) && !Number.isNaN(expires) && now >= expires) {
      return err(commsViolation("wire_expired", "reconnect", "reconnect plan expired"));
    }
    const expectedDigest = buildAdmissionReconnectPlanDigest(plan);
    if (plan.planDigest !== expectedDigest) {
      return err(commsViolation("admission_receipt_invalid", "reconnect", "plan digest mismatch"));
    }
    const active = this.deps.bindingResolver.getActiveBinding(plan.toBinding.activationDomainId);
    if (active?.bindingGeneration !== plan.toBinding.bindingGeneration) {
      return err(commsViolation("stale_binding", "reconnect", "target binding no longer active"));
    }
    if (active.epochId !== plan.toBinding.epochId) {
      return err(commsViolation("admission_receipt_invalid", "reconnect", "epoch mismatch"));
    }
    const record: ReconnectCoordinatorRecord = {
      plan,
      state: "proposed",
      updatedAt: this.deps.clock.now(),
    };
    this.deps.store.putReconnect(record);
    return ok(record);
  }

  async authorize(
    record: ReconnectCoordinatorRecord,
  ): Promise<Result<ReconnectCoordinatorRecord, CommsViolation>> {
    if (record.state !== "proposed" && record.state !== "validated") {
      return err(commsViolation("reconnect_conflict", "reconnect", "invalid state for authorize"));
    }
    if (record.plan.authorizationRef.length === 0) {
      return err(
        commsViolation("session_not_authorized", "reconnect", "authorization evidence missing"),
      );
    }
    const next: ReconnectCoordinatorRecord = {
      ...record,
      state: "authorized",
      updatedAt: this.deps.clock.now(),
    };
    this.deps.store.putReconnect(next);
    return ok(next);
  }

  async peerAccept(
    record: ReconnectCoordinatorRecord,
    peerAckDigest: string,
  ): Promise<Result<ReconnectCoordinatorRecord, CommsViolation>> {
    if (record.state !== "authorized" && record.state !== "prepared") {
      return err(
        commsViolation("reconnect_conflict", "reconnect", "invalid state for peer accept"),
      );
    }
    if (peerAckDigest !== (record.plan.planDigest as string)) {
      return err(commsViolation("reconnect_conflict", "reconnect", "peer ack digest mismatch"));
    }
    const next: ReconnectCoordinatorRecord = {
      ...record,
      state: "peerAccepted",
      peerAckDigest,
      updatedAt: this.deps.clock.now(),
    };
    this.deps.store.putReconnect(next);
    return ok(next);
  }

  async runtimeCommit(
    record: ReconnectCoordinatorRecord,
  ): Promise<Result<AdmissionReconnectReceipt, CommsViolation>> {
    if (record.state !== "peerAccepted" && record.state !== "recoveryRequired") {
      return err(
        commsViolation("reconnect_conflict", "reconnect", "invalid state for runtime commit"),
      );
    }

    const binding = this.deps.store.getSessionBinding(record.plan.sessionId);
    if (binding === undefined) {
      return err(commsViolation("session_not_authorized", "reconnect", "session binding missing"));
    }
    if (binding.channelGeneration !== record.plan.expectedChannelGeneration) {
      return err(commsViolation("stale_binding", "reconnect", "unexpected channel generation"));
    }

    const nextGeneration = channelGeneration((binding.channelGeneration as number) + 1);
    const switched = {
      ...binding,
      endpointRef: descriptorRef(record.plan.newEndpointRef as string),
      channelGeneration: nextGeneration,
      status: "active" as const,
      updatedAt: this.deps.clock.now(),
    };
    const casOk = this.deps.store.casSessionBinding({
      sessionId: record.plan.sessionId,
      expectedGeneration: binding.channelGeneration,
      next: switched,
    });
    if (!casOk) {
      const failed: ReconnectCoordinatorRecord = {
        ...record,
        state: "recoveryRequired",
        updatedAt: this.deps.clock.now(),
      };
      this.deps.store.putReconnect(failed);
      return err(commsViolation("reconnect_conflict", "reconnect", "session binding CAS failed"));
    }

    const commitResult = await this.deps.runtimeCommit.commitReconnect({
      planDigest: record.plan.planDigest as string,
      admissionId: record.plan.admissionReceipt.admissionId as string,
    });
    if (!commitResult.ok) {
      const failed: ReconnectCoordinatorRecord = {
        ...record,
        state: "recoveryRequired",
        updatedAt: this.deps.clock.now(),
      };
      this.deps.store.putReconnect(failed);
      return commitResult;
    }

    const receipt: AdmissionReconnectReceipt = {
      planId: record.plan.planId,
      planDigest: record.plan.planDigest,
      runtimeReceiptRef: commitResult.value.receiptRef,
      storeSequence: this.deps.store.nextSequence(),
      newChannelGeneration: nextGeneration,
      committedAt: this.deps.clock.now(),
    };

    const completed: ReconnectCoordinatorRecord = {
      ...record,
      state: "completed",
      runtimeReceiptRef: commitResult.value.receiptRef,
      updatedAt: receipt.committedAt,
    };

    const event: CommsEventEnvelope = {
      eventId: commsEventId(`evt-reconnect-${record.plan.planId as string}`),
      storeSequence: receipt.storeSequence,
      kind: "ReconnectCommitted",
      occurredAt: receipt.committedAt,
      correlationId: record.plan.metadata.correlationId as string,
      occurrenceId: record.plan.metadata.occurrenceId as string,
      payload: {
        planDigest: record.plan.planDigest as string,
        admissionId: record.plan.admissionReceipt.admissionId as string,
      },
    };

    const occurrence: CommunicationOccurrenceRecord = {
      operation: resolveOperationBinding({
        operationCode: "reconnect",
        operationTemplateRef: record.plan.operationTemplateRef,
        codecRef: "comms/wire-v1",
        handlerManifestRef: record.plan.toBinding.handlerManifestRef,
        protocolVersion: "comms/1",
      }),
      phase: "reconnected",
      lifecycle: "complete",
      disposition: "successful",
      nativeAction: boundOutputAction({
        freshEndpointRef: record.plan.newEndpointRef,
        freshChannelId: binding.channelId,
        derivativeTargetRef: record.plan.oldEndpointRef as string,
      }),
      metadata: record.plan.metadata,
      beforeSnapshotRef: record.plan.admissionReceipt.beforeSnapshotRef,
      afterSnapshotRef: record.plan.admissionReceipt.afterSnapshotRef,
      effectiveFootprint: emptyFootprint(),
      replayEvidenceRef: commitResult.value.receiptRef,
      transportAttemptRefs: [],
      recordedAt: receipt.committedAt,
    };

    const persisted = this.deps.store.finalizeReconnect({
      record: completed,
      receipt,
      event,
      occurrence,
    });
    if (persisted === "conflict") {
      return err(commsViolation("reconnect_conflict", "reconnect", "reconnect finalize conflict"));
    }
    this.deps.events.emit(event);
    return ok(receipt);
  }

  async recover(
    planId: AdmissionReconnectPlan["planId"],
  ): Promise<Result<AdmissionReconnectReceipt, CommsViolation>> {
    const record = this.deps.store.getReconnect(planId);
    if (record === undefined) {
      return err(commsViolation("invalid_input", "recover", "reconnect record missing"));
    }
    if (record.state === "completed") {
      const receipt: AdmissionReconnectReceipt = {
        planId: record.plan.planId,
        planDigest: record.plan.planDigest,
        ...(record.runtimeReceiptRef !== undefined
          ? { runtimeReceiptRef: record.runtimeReceiptRef }
          : {}),
        storeSequence: this.deps.store.nextSequence(),
        newChannelGeneration: channelGeneration(
          (record.plan.expectedChannelGeneration as number) + 1,
        ),
        committedAt: record.updatedAt,
      };
      return ok(receipt);
    }
    return this.runtimeCommit(record);
  }
}

export function buildAdmissionReconnectPlanDigest(
  plan: Omit<AdmissionReconnectPlan, "planDigest">,
): ReturnType<typeof planDigest> {
  return planDigest(
    JSON.stringify({
      admissionId: plan.admissionReceipt.admissionId,
      admissionReceiptDigest: plan.admissionReceiptDigest,
      sessionId: plan.sessionId,
      operationTemplateRef: plan.operationTemplateRef,
      fromBindingGeneration: plan.fromBinding.bindingGeneration,
      toBindingGeneration: plan.toBinding.bindingGeneration,
      toEpochId: plan.toBinding.epochId,
      oldEndpointRef: plan.oldEndpointRef,
      newEndpointRef: plan.newEndpointRef,
      expectedChannelGeneration: plan.expectedChannelGeneration,
      expectedRuntimeHead: plan.expectedRuntimeHead,
      authorizationRef: plan.authorizationRef,
      expiresAt: plan.expiresAt,
    }),
  );
}
