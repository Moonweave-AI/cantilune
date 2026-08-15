import { isDeepStrictEqual } from "node:util";
import type {
  ActivationDomainId,
  BindingGeneration,
  SchemaAdmissionId,
  SchemaEpochBinding,
  SchemaRef,
  SnapshotRef,
  CollaborationSnapshot,
} from "@cantilune/core";
import { err, ok, schemaAdmissionId, validateSnapshotIntegrity } from "@cantilune/core";
import type { AdmissionRegistry } from "../admission/admissionRegistry.js";
import type { DurableCoordinator } from "../ports/durableCoordinator.js";
import type { ResourceLockTable } from "../ports/resourceLockTable.js";
import type {
  EpochTransitionRequest,
  PreparedEpochTransition,
  RuntimeActivationState,
  RuntimeEpochAdministration,
  RuntimeEpochReceipt,
} from "../ports/runtimeEpochAdministration.js";
import { runtimeViolation } from "../foundation/errors.js";
import type { RuntimeViolation } from "../foundation/errors.js";
import type { ActiveSchemaContext } from "./activeSchemaContext.js";
import { createActiveSchemaContext, snapshotSchemaEpochBinding } from "./activeSchemaContext.js";
import { snapshotWithAdvancedEpoch } from "./epochTransitionSnapshot.js";
import type { IdGenerator } from "../ports/idGenerator.js";
import { snapshotOrchestrationSchema } from "../schema/orchestrationSchema.js";
import { schemaContentDigest } from "../schema/schemaContentDigest.js";

export interface MutableSchemaContextHolder {
  get(): ActiveSchemaContext;
  set(context: ActiveSchemaContext): void;
}

export interface MutableBindingHolder {
  get(): SchemaEpochBinding;
  set(binding: SchemaEpochBinding): void;
}

export interface MemoryEpochAdministrationDeps {
  readonly durable: DurableCoordinator;
  readonly registry: AdmissionRegistry;
  readonly locks: ResourceLockTable;
  readonly schemaHolder: MutableSchemaContextHolder;
  readonly bindingHolder: MutableBindingHolder;
  readonly domainId: ActivationDomainId;
  readonly idGen: IdGenerator;
  readonly resolveSchema: (ref: SchemaRef) => ActiveSchemaContext["schema"] | undefined;
  readonly preparationTtlMs?: number;
}

interface PreparedRecord {
  readonly request: EpochTransitionRequest;
  readonly prepared: PreparedEpochTransition;
  readonly afterRef: SnapshotRef;
  readonly toBinding: SchemaEpochBinding;
  /** Schema bytes resolved and validated at prepare time. */
  readonly targetSchema: ActiveSchemaContext["schema"];
  /** Fully constructed before the durable head is allowed to move. */
  readonly targetContext: ActiveSchemaContext;
}

interface CommittedJournalEntry {
  readonly receipt: RuntimeEpochReceipt;
  readonly prepared: PreparedEpochTransition;
  readonly request: EpochTransitionRequest;
  readonly targetSchema: ActiveSchemaContext["schema"];
}

function ownDataProperty<Source extends object, Key extends keyof Source>(
  source: Source,
  key: Key,
): Source[Key];
function ownDataProperty<Value>(source: object, key: PropertyKey): Value;
function ownDataProperty<Value>(source: object, key: PropertyKey): Value {
  const descriptor = Object.getOwnPropertyDescriptor(source, key);
  if (descriptor === undefined || !("value" in descriptor)) {
    throw new TypeError(`Expected own data property ${String(key)}`);
  }
  return descriptor.value as Value;
}

function optionalOwnDataProperty<Source extends object, Key extends keyof Source>(
  source: Source,
  key: Key,
): Source[Key] | undefined;
function optionalOwnDataProperty<Value>(source: object, key: PropertyKey): Value | undefined;
function optionalOwnDataProperty<Value>(source: object, key: PropertyKey): Value | undefined {
  const descriptor = Object.getOwnPropertyDescriptor(source, key);
  if (descriptor === undefined) return undefined;
  if (!("value" in descriptor)) {
    throw new TypeError(`Expected own data property ${String(key)}`);
  }
  return descriptor.value as Value;
}

function snapshotSchemaRef(ref: SchemaRef): SchemaRef {
  if (ref === null || typeof ref !== "object") {
    throw new TypeError("Expected schema ref object");
  }
  return Object.freeze({
    schemaId: ownDataProperty(ref, "schemaId"),
    revisionId: ownDataProperty(ref, "revisionId"),
    digest: ownDataProperty(ref, "digest"),
  });
}

function snapshotEpochTransitionRequest(request: EpochTransitionRequest): EpochTransitionRequest {
  if (request === null || typeof request !== "object") {
    throw new TypeError("Expected epoch transition request object");
  }
  return Object.freeze({
    admissionId: ownDataProperty(request, "admissionId"),
    domainId: ownDataProperty(request, "domainId"),
    expectedBindingGeneration: ownDataProperty(request, "expectedBindingGeneration"),
    expectedHead: ownDataProperty(request, "expectedHead"),
    expectedEpochId: ownDataProperty(request, "expectedEpochId"),
    expectedEpochOrdinal: ownDataProperty(request, "expectedEpochOrdinal"),
    targetSchemaRef: snapshotSchemaRef(ownDataProperty(request, "targetSchemaRef")),
    targetEpochId: ownDataProperty(request, "targetEpochId"),
    targetEpochOrdinal: ownDataProperty(request, "targetEpochOrdinal"),
    planDigest: ownDataProperty(request, "planDigest"),
  });
}

function snapshotPreparedEpochTransition(
  prepared: PreparedEpochTransition,
): PreparedEpochTransition {
  if (prepared === null || typeof prepared !== "object") {
    throw new TypeError("Expected prepared epoch transition object");
  }
  return Object.freeze({
    preparedId: ownDataProperty(prepared, "preparedId"),
    planDigest: ownDataProperty(prepared, "planDigest"),
    issuedAt: ownDataProperty(prepared, "issuedAt"),
    expiresAt: ownDataProperty(prepared, "expiresAt"),
  });
}

function snapshotRuntimeEpochReceipt(receipt: RuntimeEpochReceipt): RuntimeEpochReceipt {
  if (receipt === null || typeof receipt !== "object") {
    throw new TypeError("Expected runtime epoch receipt object");
  }
  return Object.freeze({
    admissionId: ownDataProperty(receipt, "admissionId"),
    beforeSnapshotRef: ownDataProperty(receipt, "beforeSnapshotRef"),
    afterSnapshotRef: ownDataProperty(receipt, "afterSnapshotRef"),
    fromBinding: snapshotSchemaEpochBinding(ownDataProperty(receipt, "fromBinding")),
    toBinding: snapshotSchemaEpochBinding(ownDataProperty(receipt, "toBinding")),
  });
}

function snapshotActiveSchemaContext(context: ActiveSchemaContext): ActiveSchemaContext {
  if (context === null || typeof context !== "object") {
    throw new TypeError("Expected active schema context object");
  }
  return createActiveSchemaContext(
    ownDataProperty(context, "schema"),
    ownDataProperty(context, "epochId"),
    optionalOwnDataProperty(context, "binding"),
  );
}

const SCHEMA_PROPERTIES = new Set([
  "schemaId",
  "wireVersion",
  "objectTypes",
  "operationTypes",
  "templates",
  "resourceRules",
]);

function snapshotResolvedSchema(
  schema: ActiveSchemaContext["schema"],
): ActiveSchemaContext["schema"] {
  if (schema === null || typeof schema !== "object") {
    throw new TypeError("Expected orchestration schema object");
  }
  if (Object.keys(schema).some((key) => !SCHEMA_PROPERTIES.has(key))) {
    throw new TypeError("Unexpected orchestration schema property");
  }
  for (const key of SCHEMA_PROPERTIES) {
    ownDataProperty(schema, key);
  }
  return snapshotOrchestrationSchema(schema);
}

function sortedMapEntries<Key, Value>(
  map: ReadonlyMap<Key, Value>,
): readonly (readonly [Key, Value])[] {
  return [...map.entries()].sort(([left], [right]) => String(left).localeCompare(String(right)));
}

function schemasEqual(
  left: ActiveSchemaContext["schema"],
  right: ActiveSchemaContext["schema"],
): boolean {
  return (
    left.schemaId === right.schemaId &&
    left.wireVersion === right.wireVersion &&
    isDeepStrictEqual(sortedMapEntries(left.objectTypes), sortedMapEntries(right.objectTypes)) &&
    isDeepStrictEqual(
      sortedMapEntries(left.operationTypes),
      sortedMapEntries(right.operationTypes),
    ) &&
    isDeepStrictEqual(left.templates, right.templates) &&
    isDeepStrictEqual(left.resourceRules, right.resourceRules)
  );
}

function sessionsQuiescent(snapshot: CollaborationSnapshot): boolean {
  return snapshot.sessions.size === 0;
}

/**
 * Runtime-side validation of the resolver contract.
 *
 * Runtime recomputes the canonical content digest so a resolver cannot attach
 * arbitrary content to a valid-looking SchemaRef.
 */
function validateResolvedSchema(
  ref: SchemaRef,
  schema: ActiveSchemaContext["schema"],
): RuntimeViolation | undefined {
  if (schema.schemaId !== ref.schemaId) {
    return runtimeViolation("template_not_found", "resolved schema id does not match target ref", {
      expected: ref.schemaId,
      actual: schema.schemaId,
      path: "targetSchemaRef.schemaId",
    });
  }
  const actualDigest = schemaContentDigest(schema);
  if (actualDigest !== ref.digest) {
    return runtimeViolation(
      "admission_rejected",
      "resolved schema digest does not match target ref",
      {
        expected: ref.digest,
        actual: actualDigest,
        path: "targetSchemaRef.digest",
      },
    );
  }
  if (!Number.isSafeInteger(schema.wireVersion) || schema.wireVersion < 1) {
    return runtimeViolation("admission_rejected", "resolved schema has invalid wire version", {
      actual: String(schema.wireVersion),
      path: "schema.wireVersion",
    });
  }

  const templateKeys = new Set<string>();
  for (const template of schema.templates) {
    if (template.templateRef.operationTypeId !== template.operationTypeId) {
      return runtimeViolation(
        "admission_rejected",
        "resolved schema template identity is inconsistent",
        { path: `schema.templates.${String(template.operationTypeId)}` },
      );
    }
    const key = `${String(template.operationTypeId)}@${template.templateRef.revision}`;
    if (templateKeys.has(key)) {
      return runtimeViolation("admission_rejected", "resolved schema contains duplicate template", {
        path: `schema.templates.${key}`,
      });
    }
    templateKeys.add(key);
  }

  for (const [operationTypeId, declaration] of schema.operationTypes) {
    if (
      declaration.operationTypeId !== operationTypeId ||
      declaration.templateRef.operationTypeId !== operationTypeId
    ) {
      return runtimeViolation(
        "admission_rejected",
        "resolved schema operation declaration identity is inconsistent",
        { operationTypeId, path: `schema.operationTypes.${String(operationTypeId)}` },
      );
    }
    const templateKey = `${String(operationTypeId)}@${declaration.templateRef.revision}`;
    if (!templateKeys.has(templateKey)) {
      return runtimeViolation(
        "template_not_found",
        "resolved schema operation declaration has no matching template",
        { operationTypeId, path: `schema.operationTypes.${String(operationTypeId)}.templateRef` },
      );
    }
  }

  return undefined;
}

function preparedTokensEqual(
  left: PreparedEpochTransition,
  right: PreparedEpochTransition,
): boolean {
  return (
    left.preparedId === right.preparedId &&
    left.planDigest === right.planDigest &&
    left.issuedAt === right.issuedAt &&
    left.expiresAt === right.expiresAt
  );
}

function validatePrepareState(
  state: RuntimeActivationState,
  request: EpochTransitionRequest,
): RuntimeViolation | undefined {
  if (state.head !== request.expectedHead) {
    return runtimeViolation("replay_mismatch", "runtime head changed during prepare");
  }
  if (state.binding.bindingGeneration !== request.expectedBindingGeneration) {
    return runtimeViolation("resource_conflict", "stale binding generation");
  }
  if (state.snapshot.epochId !== request.expectedEpochId) {
    return runtimeViolation("resource_conflict", "expected epoch mismatch");
  }
  if (state.binding.epochId !== request.expectedEpochId) {
    return runtimeViolation("resource_conflict", "active binding epoch mismatch");
  }
  if (state.binding.epochOrdinal !== request.expectedEpochOrdinal) {
    return runtimeViolation("resource_conflict", "expected epoch ordinal mismatch");
  }
  if (!state.resourcesClear) {
    return runtimeViolation("resource_conflict", "resources not clear");
  }
  if (!state.sessionsQuiescent) {
    return runtimeViolation("resource_conflict", "sessions not quiescent");
  }
  if (state.activeAdmissions !== 0) {
    return runtimeViolation("resource_conflict", "active admissions prevent epoch prepare");
  }
  if (request.targetEpochOrdinal <= state.binding.epochOrdinal) {
    return runtimeViolation("resource_conflict", "epoch ordinal must advance");
  }
  if (request.targetEpochId === state.binding.epochId) {
    return runtimeViolation("resource_conflict", "target epoch id must advance");
  }
  return undefined;
}

function validateCommitState(
  deps: MemoryEpochAdministrationDeps,
  record: PreparedRecord,
  before: CollaborationSnapshot,
  currentBinding: SchemaEpochBinding,
  resourcesClear: (snapshot: CollaborationSnapshot) => boolean,
): RuntimeViolation | undefined {
  if (currentBinding.bindingGeneration !== record.request.expectedBindingGeneration) {
    return runtimeViolation("resource_conflict", "binding changed before commit");
  }
  if (
    currentBinding.epochId !== record.request.expectedEpochId ||
    currentBinding.epochOrdinal !== record.request.expectedEpochOrdinal ||
    before.epochId !== record.request.expectedEpochId
  ) {
    return runtimeViolation("resource_conflict", "epoch changed before commit");
  }
  if (!resourcesClear(before) || deps.registry.activeCount() !== 0) {
    return runtimeViolation("resource_conflict", "runtime is not quiescent at commit");
  }
  if (!sessionsQuiescent(before)) {
    return runtimeViolation("resource_conflict", "sessions not quiescent at commit");
  }
  return undefined;
}

function resolveUnchangedTargetSchema(
  deps: MemoryEpochAdministrationDeps,
  record: PreparedRecord,
): { readonly ok: true } | { readonly ok: false; readonly violation: RuntimeViolation } {
  const resolvedTargetSchema = deps.resolveSchema(record.request.targetSchemaRef);
  if (resolvedTargetSchema === undefined) {
    return {
      ok: false,
      violation: runtimeViolation("template_not_found", "target schema missing at commit"),
    };
  }
  let targetSchema: ActiveSchemaContext["schema"];
  try {
    targetSchema = snapshotResolvedSchema(resolvedTargetSchema);
  } catch {
    return {
      ok: false,
      violation: runtimeViolation("admission_rejected", "target schema cannot be cached"),
    };
  }
  const schemaViolation = validateResolvedSchema(record.request.targetSchemaRef, targetSchema);
  if (schemaViolation !== undefined) {
    return { ok: false, violation: schemaViolation };
  }
  if (!schemasEqual(targetSchema, record.targetSchema)) {
    return {
      ok: false,
      violation: runtimeViolation("admission_rejected", "target schema changed after prepare"),
    };
  }
  return { ok: true };
}

export function createMemoryEpochAdministration(
  deps: MemoryEpochAdministrationDeps,
): RuntimeEpochAdministration {
  const prepared = new Map<string, PreparedRecord>();
  const committed = new Map<SchemaAdmissionId, CommittedJournalEntry>();
  const ttlMs = deps.preparationTtlMs ?? 60_000;

  function pruneExpiredPreparations(now = Date.now()): void {
    for (const [preparedId, record] of prepared) {
      if (now > Date.parse(record.prepared.expiresAt)) {
        prepared.delete(preparedId);
      }
    }
  }

  function resourcesClear(_snapshot: CollaborationSnapshot): boolean {
    return deps.locks.heldLockCount() === 0;
  }

  return {
    async inspectActivationPoint(domainId) {
      pruneExpiredPreparations();
      if (domainId !== deps.domainId) {
        return err(runtimeViolation("resource_conflict", "unknown activation domain"));
      }
      const headRef = deps.durable.head();
      if (headRef === undefined) {
        return err(runtimeViolation("replay_mismatch", "runtime head missing"));
      }
      const snapshot = deps.durable.get(headRef);
      if (snapshot === undefined) {
        return err(runtimeViolation("replay_mismatch", "head snapshot missing"));
      }
      return ok(
        Object.freeze({
          domainId,
          binding: deps.bindingHolder.get(),
          head: headRef,
          snapshot,
          resourcesClear: resourcesClear(snapshot),
          sessionsQuiescent: sessionsQuiescent(snapshot),
          activeAdmissions: deps.registry.activeCount() + prepared.size,
        } satisfies RuntimeActivationState),
      );
    },

    async prepareEpochTransition(request) {
      pruneExpiredPreparations();
      let requestSnapshot: EpochTransitionRequest;
      try {
        requestSnapshot = snapshotEpochTransitionRequest(request);
      } catch {
        return err(runtimeViolation("admission_rejected", "invalid epoch transition request"));
      }
      const preparedId = `prep-${requestSnapshot.admissionId}`;
      const existingPrepared = prepared.get(preparedId);
      if (existingPrepared !== undefined) {
        return isDeepStrictEqual(existingPrepared.request, requestSnapshot)
          ? ok(snapshotPreparedEpochTransition(existingPrepared.prepared))
          : err(runtimeViolation("admission_rejected", "conflicting epoch preparation retry"));
      }
      const existingCommit = committed.get(requestSnapshot.admissionId);
      if (existingCommit !== undefined) {
        return isDeepStrictEqual(existingCommit.request, requestSnapshot)
          ? ok(snapshotPreparedEpochTransition(existingCommit.prepared))
          : err(runtimeViolation("admission_rejected", "conflicting committed epoch retry"));
      }

      const inspect = await this.inspectActivationPoint(requestSnapshot.domainId);
      if (!inspect.ok) {
        return inspect;
      }
      const currentBinding = deps.bindingHolder.get();
      const stateViolation = validatePrepareState(inspect.value, requestSnapshot);
      if (stateViolation !== undefined) {
        return err(stateViolation);
      }

      const resolvedTargetSchema = deps.resolveSchema(requestSnapshot.targetSchemaRef);
      if (resolvedTargetSchema === undefined) {
        return err(runtimeViolation("template_not_found", "target schema not found"));
      }
      let cachedTargetSchema: ActiveSchemaContext["schema"];
      try {
        cachedTargetSchema = snapshotResolvedSchema(resolvedTargetSchema);
      } catch {
        return err(runtimeViolation("admission_rejected", "target schema cannot be cached"));
      }
      const schemaViolation = validateResolvedSchema(
        requestSnapshot.targetSchemaRef,
        cachedTargetSchema,
      );
      if (schemaViolation !== undefined) {
        return err(schemaViolation);
      }

      const afterRef = deps.idGen.snapshotRef();
      const now = Date.now();
      const preparedToken = snapshotPreparedEpochTransition({
        preparedId,
        planDigest: requestSnapshot.planDigest,
        issuedAt: new Date(now).toISOString(),
        expiresAt: new Date(now + ttlMs).toISOString(),
      });

      const toBinding = snapshotSchemaEpochBinding({
        ...currentBinding,
        bindingGeneration: (currentBinding.bindingGeneration + 1) as BindingGeneration,
        epochId: requestSnapshot.targetEpochId,
        epochOrdinal: requestSnapshot.targetEpochOrdinal,
        schemaRef: requestSnapshot.targetSchemaRef,
        runtimeHead: afterRef,
        admissionId: requestSnapshot.admissionId,
        previousBindingGeneration: currentBinding.bindingGeneration,
        activatedBy: "runtime-epoch-admin",
        activatedAt: new Date(now).toISOString(),
      });
      const targetContext = createActiveSchemaContext(
        cachedTargetSchema,
        requestSnapshot.targetEpochId,
        toBinding,
      );

      prepared.set(
        preparedToken.preparedId,
        Object.freeze({
          request: requestSnapshot,
          prepared: preparedToken,
          afterRef,
          toBinding,
          targetSchema: cachedTargetSchema,
          targetContext,
        }),
      );

      return ok(snapshotPreparedEpochTransition(preparedToken));
    },

    async commitEpochTransition(preparedToken) {
      let tokenSnapshot: PreparedEpochTransition;
      try {
        tokenSnapshot = snapshotPreparedEpochTransition(preparedToken);
      } catch {
        return err(runtimeViolation("admission_rejected", "invalid prepared token"));
      }
      const record = prepared.get(tokenSnapshot.preparedId);
      if (record === undefined) {
        const admissionSuffix = tokenSnapshot.preparedId.replace(/^prep-/, "");
        const existing = committed.get(schemaAdmissionId(admissionSuffix));
        if (existing !== undefined && preparedTokensEqual(existing.prepared, tokenSnapshot)) {
          return ok(snapshotRuntimeEpochReceipt(existing.receipt));
        }
        return err(runtimeViolation("admission_rejected", "prepared token not found"));
      }
      const prior = committed.get(record.request.admissionId);
      if (prior !== undefined) {
        return ok(snapshotRuntimeEpochReceipt(prior.receipt));
      }
      if (!preparedTokensEqual(record.prepared, tokenSnapshot)) {
        return err(runtimeViolation("admission_rejected", "prepared token payload mismatch"));
      }
      if (Date.now() > Date.parse(record.prepared.expiresAt)) {
        prepared.delete(tokenSnapshot.preparedId);
        return err(runtimeViolation("admission_rejected", "preparation expired"));
      }

      const headRef = deps.durable.head();
      if (headRef !== record.request.expectedHead) {
        return err(runtimeViolation("replay_mismatch", "head changed before commit"));
      }
      const before = deps.durable.get(headRef);
      if (before === undefined) {
        return err(runtimeViolation("replay_mismatch", "before snapshot missing"));
      }

      const currentBinding = deps.bindingHolder.get();
      const stateViolation = validateCommitState(
        deps,
        record,
        before,
        currentBinding,
        resourcesClear,
      );
      if (stateViolation !== undefined) {
        return err(stateViolation);
      }

      // Resolve again to prove that the target ref still names the exact schema
      // that was validated and cached during prepare.  This closes the
      // resolver TOCTOU window without trusting object identity.
      const schemaCheck = resolveUnchangedTargetSchema(deps, record);
      if (!schemaCheck.ok) {
        return err(schemaCheck.violation);
      }

      const after = snapshotWithAdvancedEpoch(
        before,
        record.afterRef,
        record.request.targetEpochId,
      );
      try {
        validateSnapshotIntegrity(after);
      } catch {
        return err(runtimeViolation("commit_atomic_failed", "epoch snapshot failed validation"));
      }
      if (!deps.durable.compareAndSwapHeadWithBinding(headRef, after, record.toBinding)) {
        return err(runtimeViolation("commit_atomic_failed", "CAS head failed"));
      }

      // The head and the active binding are now durable together (ADR-0014).
      // These in-memory updates are convergent reconstructions of durable
      // state: a crash between the CAS above and these lines is harmless
      // because the bundle carries the binding and recoverEpochTransition
      // (or the boot bundle-sourced path) reconstructs the holders from it.
      deps.schemaHolder.set(record.targetContext);
      deps.bindingHolder.set(record.toBinding);

      const receipt = snapshotRuntimeEpochReceipt({
        admissionId: record.request.admissionId,
        beforeSnapshotRef: headRef,
        afterSnapshotRef: record.afterRef,
        fromBinding: currentBinding,
        toBinding: record.toBinding,
      });
      committed.set(
        record.request.admissionId,
        Object.freeze({
          receipt,
          prepared: record.prepared,
          request: record.request,
          targetSchema: record.targetSchema,
        }),
      );
      prepared.delete(tokenSnapshot.preparedId);
      return ok(snapshotRuntimeEpochReceipt(receipt));
    },

    async recoverEpochTransition(admissionId) {
      const entry = committed.get(admissionId);
      if (entry === undefined) {
        // Post-crash path (ADR-0014 SS-02): the in-memory journal is gone, but
        // the durable bundle carries the active binding atomically with the
        // head. Reconstruct the holders from the bundle instead of failing.
        // The admissionId must match the durable binding's admissionId so a
        // stale or replayed recovery request cannot adopt a different epoch.
        const durableBinding = deps.durable.activeBinding();
        if (durableBinding === undefined) {
          return err(
            runtimeViolation("replay_mismatch", "no committed epoch transition to recover"),
          );
        }
        if (durableBinding.admissionId !== admissionId) {
          return err(
            runtimeViolation(
              "replay_mismatch",
              "durable binding admission id does not match recovery request",
            ),
          );
        }
        const headRef = deps.durable.head();
        const head = headRef === undefined ? undefined : deps.durable.get(headRef);
        if (head === undefined || head.epochId !== durableBinding.epochId) {
          return err(
            runtimeViolation("replay_mismatch", "durable binding epoch is not the active head epoch"),
          );
        }
        const resolvedTargetSchema = deps.resolveSchema(durableBinding.schemaRef);
        if (resolvedTargetSchema === undefined) {
          return err(
            runtimeViolation("template_not_found", "target schema missing during recovery"),
          );
        }
        let targetSchema: ActiveSchemaContext["schema"];
        try {
          targetSchema = snapshotResolvedSchema(resolvedTargetSchema);
        } catch {
          return err(runtimeViolation("admission_rejected", "target schema cannot be cached"));
        }
        const schemaViolation = validateResolvedSchema(durableBinding.schemaRef, targetSchema);
        if (schemaViolation !== undefined) {
          return err(schemaViolation);
        }
        const targetContext = createActiveSchemaContext(
          targetSchema,
          durableBinding.epochId,
          durableBinding,
        );
        deps.schemaHolder.set(targetContext);
        deps.bindingHolder.set(durableBinding);
        const receipt: RuntimeEpochReceipt = {
          admissionId: durableBinding.admissionId,
          beforeSnapshotRef: durableBinding.runtimeHead,
          afterSnapshotRef: headRef as SnapshotRef,
          fromBinding: durableBinding,
          toBinding: durableBinding,
        };
        return ok(snapshotRuntimeEpochReceipt(receipt));
      }
      const headRef = deps.durable.head();
      const head = headRef === undefined ? undefined : deps.durable.get(headRef);
      if (head === undefined || head.epochId !== entry.receipt.toBinding.epochId) {
        return err(runtimeViolation("replay_mismatch", "committed epoch snapshot is not active"));
      }
      const resolvedTargetSchema = deps.resolveSchema(entry.receipt.toBinding.schemaRef);
      if (resolvedTargetSchema === undefined) {
        return err(runtimeViolation("template_not_found", "target schema missing during recovery"));
      }
      let targetSchema: ActiveSchemaContext["schema"];
      try {
        targetSchema = snapshotResolvedSchema(resolvedTargetSchema);
      } catch {
        return err(runtimeViolation("admission_rejected", "target schema cannot be cached"));
      }
      const schemaViolation = validateResolvedSchema(
        entry.receipt.toBinding.schemaRef,
        targetSchema,
      );
      if (schemaViolation !== undefined) {
        return err(schemaViolation);
      }
      if (!schemasEqual(targetSchema, entry.targetSchema)) {
        return err(runtimeViolation("admission_rejected", "target schema changed before recovery"));
      }
      const targetContext = createActiveSchemaContext(
        entry.targetSchema,
        entry.receipt.toBinding.epochId,
        entry.receipt.toBinding,
      );
      deps.schemaHolder.set(targetContext);
      deps.bindingHolder.set(entry.receipt.toBinding);
      return ok(snapshotRuntimeEpochReceipt(entry.receipt));
    },
  };
}

export function createMutableSchemaContextHolder(
  initial: ActiveSchemaContext,
): MutableSchemaContextHolder {
  let current = snapshotActiveSchemaContext(initial);
  const holder: MutableSchemaContextHolder = {
    get: () => current,
    set: (context) => {
      current = snapshotActiveSchemaContext(context);
    },
  };
  return Object.freeze(holder);
}

import type { PolicyEvaluator } from "../ports/policyEvaluator.js";

export interface MutablePolicyEvaluatorHolder {
  get(): PolicyEvaluator;
  set(evaluator: PolicyEvaluator): void;
}

export function createMutablePolicyEvaluatorHolder(
  initial: PolicyEvaluator,
): MutablePolicyEvaluatorHolder {
  let current = initial;
  return {
    get: () => current,
    set: (evaluator) => {
      current = evaluator;
    },
  };
}

export function createMutableBindingHolder(initial: SchemaEpochBinding): MutableBindingHolder {
  let current = snapshotSchemaEpochBinding(initial);
  const holder: MutableBindingHolder = {
    get: () => current,
    set: (binding) => {
      current = snapshotSchemaEpochBinding(binding);
    },
  };
  return Object.freeze(holder);
}
