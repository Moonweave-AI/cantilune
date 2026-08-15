import { randomUUID } from "node:crypto";
import {
  bindingGeneration,
  controlPlaneEventId,
  storeSequence,
  type ActivationDomainId,
  type IdempotencyKey,
  type PreparedAdmissionId,
  type SchemaAdmissionId,
  type SchemaAdmissionReceipt,
  type SchemaEpochBinding,
  type SchemaRef,
  type StoreSequence,
} from "@cantilune/core";
import { snapshotSchemaEpochBinding } from "@cantilune/runtime";
import type {
  ControlPlaneEventEnvelope,
  ControlPlaneSnapshot,
  ControlPlaneStore,
  ActiveBindingCas,
  FinalizeAdmissionCommitInput,
  FinalizeAdmissionCommitResult,
  IdempotencyClaim,
} from "../ports/controlPlaneStore.js";
import {
  revisionKey as toRevisionKey,
  snapshotSchemaRevision,
  verifySchemaRevisionIntegrity,
  type SchemaRevision,
} from "../schema/schemaRevision.js";
import {
  snapshotPolicyRevision,
  verifyPolicyRevisionIntegrity,
  type PolicyRevision,
} from "../policy/policyRevision.js";
import type { SchemaAdmissionRecord } from "../admission/schemaAdmissionRequest.js";
import type {
  CommitDecisionRecord,
  PreparedAdmissionRecord,
} from "../admission/preparedAdmissionRecord.js";

function detachedValue<Value>(value: Value): Value {
  return structuredClone(value);
}

export class MemoryControlPlaneStore implements ControlPlaneStore {
  private readonly revisions = new Map<string, SchemaRevision>();
  private readonly policies = new Map<string, PolicyRevision>();
  private readonly activeBindings = new Map<ActivationDomainId, SchemaEpochBinding>();
  private readonly admissions = new Map<SchemaAdmissionId, SchemaAdmissionRecord>();
  private readonly preparedAdmissions = new Map<PreparedAdmissionId, PreparedAdmissionRecord>();
  private readonly commitDecisions = new Map<SchemaAdmissionId, CommitDecisionRecord>();
  private readonly commitReceipts = new Map<SchemaAdmissionId, SchemaAdmissionReceipt>();
  private readonly idempotency = new Map<
    IdempotencyKey,
    { readonly digest: string; readonly resultRef: string }
  >();
  private events: ControlPlaneEventEnvelope[] = [];
  private sequence = 0;
  private frozen = false;

  getRevision(ref: SchemaRef): SchemaRevision | undefined {
    const stored = this.revisions.get(toRevisionKey(ref));
    if (stored === undefined) {
      return undefined;
    }
    if (!verifySchemaRevisionIntegrity(stored)) {
      throw new Error("schema_revision_integrity_violation");
    }
    if (stored.schemaRef.digest !== ref.digest) {
      return undefined;
    }
    return snapshotSchemaRevision(stored);
  }

  listRevisions(schemaId?: string): readonly SchemaRevision[] {
    const all = [...this.revisions.values()].map(snapshotSchemaRevision);
    if (schemaId === undefined) {
      return all;
    }
    return all.filter((revision) => revision.schemaRef.schemaId === schemaId);
  }

  registerRevision(revision: SchemaRevision): void {
    if (!verifySchemaRevisionIntegrity(revision)) {
      throw new Error("schema_revision_integrity_violation");
    }
    const key = toRevisionKey(revision.schemaRef);
    const existing = this.revisions.get(key);
    if (existing !== undefined) {
      if (existing.canonicalDigest === revision.canonicalDigest) {
        return;
      }
      throw new Error("revision_conflict");
    }
    this.revisions.set(key, snapshotSchemaRevision(revision));
  }

  getActiveBinding(domainId: ActivationDomainId): SchemaEpochBinding | undefined {
    const binding = this.activeBindings.get(domainId);
    return binding === undefined ? undefined : snapshotSchemaEpochBinding(binding);
  }

  casActiveBinding(cas: ActiveBindingCas): boolean {
    const current = this.activeBindings.get(cas.domainId);
    if (current === undefined) {
      if (cas.expectedGeneration !== bindingGeneration(0)) {
        return false;
      }
    } else if (current.bindingGeneration !== cas.expectedGeneration) {
      return false;
    }
    this.activeBindings.set(cas.domainId, snapshotSchemaEpochBinding(cas.nextBinding));
    return true;
  }

  registerPolicy(revision: PolicyRevision): void {
    if (!verifyPolicyRevisionIntegrity(revision)) {
      throw new Error("policy_revision_integrity_violation");
    }
    const key = `${revision.policyRef.policyId}@${revision.policyRef.revisionId}`;
    this.policies.set(key, snapshotPolicyRevision(revision));
  }

  getPolicy(ref: PolicyRevision["policyRef"]): PolicyRevision | undefined {
    const stored = this.policies.get(`${ref.policyId}@${ref.revisionId}`);
    if (stored === undefined || stored.policyRef.digest !== ref.digest) return undefined;
    if (!verifyPolicyRevisionIntegrity(stored)) {
      throw new Error("policy_revision_integrity_violation");
    }
    return snapshotPolicyRevision(stored);
  }

  getAdmission(id: SchemaAdmissionId): SchemaAdmissionRecord | undefined {
    const record = this.admissions.get(id);
    return record === undefined ? undefined : detachedValue(record);
  }

  putAdmission(record: SchemaAdmissionRecord): void {
    const snapshot = detachedValue(record);
    this.admissions.set(snapshot.request.admissionId, snapshot);
  }

  getPrepared(preparedId: PreparedAdmissionId): PreparedAdmissionRecord | undefined {
    const record = this.preparedAdmissions.get(preparedId);
    return record === undefined ? undefined : detachedValue(record);
  }

  putPrepared(record: PreparedAdmissionRecord): void {
    const snapshot = detachedValue(record);
    this.preparedAdmissions.set(snapshot.preparedId, snapshot);
  }

  consumePrepared(preparedId: PreparedAdmissionId): PreparedAdmissionRecord | undefined {
    const record = this.preparedAdmissions.get(preparedId);
    if (record === undefined || record.consumed) {
      return undefined;
    }
    this.preparedAdmissions.set(preparedId, detachedValue({ ...record, consumed: true }));
    return detachedValue(record);
  }

  getCommitDecision(admissionId: SchemaAdmissionId): CommitDecisionRecord | undefined {
    const record = this.commitDecisions.get(admissionId);
    return record === undefined ? undefined : detachedValue(record);
  }

  putCommitDecision(record: CommitDecisionRecord): void {
    const snapshot = detachedValue(record);
    this.commitDecisions.set(snapshot.admissionId, snapshot);
  }

  getCommitReceipt(admissionId: SchemaAdmissionId): SchemaAdmissionReceipt | undefined {
    const receipt = this.commitReceipts.get(admissionId);
    return receipt === undefined ? undefined : detachedValue(receipt);
  }

  putCommitReceipt(receipt: SchemaAdmissionReceipt): void {
    const snapshot = detachedValue(receipt);
    this.commitReceipts.set(snapshot.admissionId, snapshot);
  }

  finalizeAdmissionCommit(input: FinalizeAdmissionCommitInput): FinalizeAdmissionCommitResult {
    const current = this.activeBindings.get(input.domainId);
    if (current === undefined) {
      if (input.expectedGeneration !== bindingGeneration(0)) {
        return "cas_conflict";
      }
    } else if (current.bindingGeneration !== input.expectedGeneration) {
      return "cas_conflict";
    }
    this.activeBindings.set(input.domainId, snapshotSchemaEpochBinding(input.nextBinding));
    this.putAdmission(input.admission);
    this.putCommitDecision(input.commitDecision);
    this.putCommitReceipt(input.receipt);
    this.appendEvent(input.event);
    return "finalized";
  }

  appendEvent(envelope: ControlPlaneEventEnvelope): void {
    const snapshot = detachedValue(envelope);
    const last = this.events.at(-1);
    if (
      last !== undefined &&
      (snapshot.storeSequence as number) <= (last.storeSequence as number)
    ) {
      throw new Error("event_sequence_regression");
    }
    if (this.events.some((event) => event.eventId === snapshot.eventId)) {
      throw new Error("duplicate_event_id");
    }
    this.events.push(snapshot);
    this.sequence = snapshot.storeSequence as number;
  }

  readEvents(sinceSequence?: StoreSequence): readonly ControlPlaneEventEnvelope[] {
    if (sinceSequence === undefined) {
      return this.events.map(detachedValue);
    }
    const since = sinceSequence as number;
    return this.events
      .filter((event) => (event.storeSequence as number) > since)
      .map(detachedValue);
  }

  claimIdempotency(claim: IdempotencyClaim): "claimed" | "replay" | "conflict" {
    const existing = this.idempotency.get(claim.key);
    if (existing === undefined) {
      this.idempotency.set(claim.key, { digest: claim.digest, resultRef: claim.digest });
      return "claimed";
    }
    if (existing.digest === claim.digest) {
      return "replay";
    }
    return "conflict";
  }

  releaseIdempotency(key: IdempotencyKey): void {
    this.idempotency.delete(key);
  }

  setFrozen(frozen: boolean): void {
    this.frozen = frozen;
  }

  isFrozen(): boolean {
    return this.frozen;
  }

  snapshot(): ControlPlaneSnapshot {
    return {
      revisions: new Map(
        [...this.revisions].map(([key, revision]) => [key, snapshotSchemaRevision(revision)]),
      ),
      policies: new Map(
        [...this.policies].map(([key, policy]) => [key, snapshotPolicyRevision(policy)]),
      ),
      activeBindings: new Map(
        [...this.activeBindings].map(([domainId, binding]) => [
          domainId,
          snapshotSchemaEpochBinding(binding),
        ]),
      ),
      admissions: new Map(
        [...this.admissions].map(([key, admission]) => [key, detachedValue(admission)]),
      ),
      preparedAdmissions: new Map(
        [...this.preparedAdmissions].map(([key, prepared]) => [key, detachedValue(prepared)]),
      ),
      commitDecisions: new Map(
        [...this.commitDecisions].map(([key, decision]) => [key, detachedValue(decision)]),
      ),
      commitReceipts: new Map(
        [...this.commitReceipts].map(([key, receipt]) => [key, detachedValue(receipt)]),
      ),
      idempotency: new Map(
        [...this.idempotency].map(([key, value]) => [key, detachedValue(value)]),
      ),
      events: this.events.map(detachedValue),
      frozen: this.frozen,
      lastSequence: storeSequence(this.sequence),
    };
  }

  restoreSnapshot(snapshot: ControlPlaneSnapshot): void {
    this.revisions.clear();
    this.policies.clear();
    this.activeBindings.clear();
    this.admissions.clear();
    this.preparedAdmissions.clear();
    this.commitDecisions.clear();
    this.commitReceipts.clear();
    this.idempotency.clear();
    this.events = [];
    this.sequence = 0;
    this.frozen = snapshot.frozen;
    for (const [, revision] of snapshot.revisions) {
      this.registerRevision(revision);
    }
    for (const [, policy] of snapshot.policies) {
      this.registerPolicy(policy);
    }
    for (const [domainId, binding] of snapshot.activeBindings) {
      this.activeBindings.set(domainId, snapshotSchemaEpochBinding(binding));
    }
    for (const [, admission] of snapshot.admissions) {
      this.putAdmission(admission);
    }
    for (const [preparedId, prepared] of snapshot.preparedAdmissions) {
      this.preparedAdmissions.set(preparedId, detachedValue(prepared));
    }
    for (const [admissionId, decision] of snapshot.commitDecisions) {
      this.commitDecisions.set(admissionId, detachedValue(decision));
    }
    for (const [admissionId, receipt] of snapshot.commitReceipts) {
      this.commitReceipts.set(admissionId, detachedValue(receipt));
    }
    for (const [key, value] of snapshot.idempotency) {
      this.idempotency.set(key, detachedValue(value));
    }
    this.events = snapshot.events.map(detachedValue);
    this.sequence = snapshot.lastSequence as number;
  }

  nextEvent(
    kind: ControlPlaneEventEnvelope["kind"],
    actor: string,
    payload: unknown,
    idempotencyKey?: IdempotencyKey,
  ): ControlPlaneEventEnvelope {
    this.sequence += 1;
    return {
      eventId: controlPlaneEventId(`evt-${randomUUID()}`),
      storeSequence: storeSequence(this.sequence),
      kind,
      occurredAt: new Date().toISOString(),
      actor,
      ...(idempotencyKey !== undefined ? { idempotencyKey } : {}),
      payload: detachedValue(payload),
    };
  }
}
