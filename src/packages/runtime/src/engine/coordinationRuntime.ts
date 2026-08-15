import type {
  CompositionIntent,
  CoordinationIntent,
  CoordinationChange,
  CollaborationSnapshot,
  RunHistory,
  ActorRef,
  SnapshotRef,
} from "@cantilune/core";
import { coordinationIntentFromComposition } from "../admission/compositionBridge.js";
import { runtimeViolation } from "../foundation/errors.js";
import type { RuntimeViolation } from "../foundation/errors.js";
import { AdmissionRegistry } from "../admission/admissionRegistry.js";
import { createAdmissionGateway } from "../admission/admissionGateway.js";
import type { AdmissionResult } from "../admission/admissionGateway.js";
import type { AdmissionTicket } from "../admission/admissionTicket.js";
import { createCommitter } from "../execution/commitChange.js";
import type { CommitResult } from "../execution/commitChange.js";
import { createReplayVerifier } from "../execution/replayVerifier.js";
import type { ReplayOptions, ReplayResult } from "../execution/replayVerifier.js";
import { ingestObservation } from "../observe/ingestObservation.js";
import type { ObserveInput, ObserveResult } from "../observe/ingestObservation.js";
import { denyByDefaultPolicyEvaluator } from "../ports/policyEvaluator.js";
import type { RuntimeDependencies } from "./runtimeDependencies.js";

export interface CoordinationRuntime {
  getHead(): CollaborationSnapshot | undefined;
  getRunHistory(): RunHistory | undefined;
  /**
   * Committed-change feed (ADR-0015). Returns every committed change after the
   * given cursor snapshot ref, in commit order. With no cursor it returns all
   * committed changes. This is the trusted feed a swarm supervisor subscribes
   * to; it is the same authority `getHead` reads from.
   */
  changes(since?: SnapshotRef): readonly CoordinationChange[];
  observe(
    input: ObserveInput,
    options?: { readonly principal?: ActorRef },
  ): ObserveResult | RuntimeViolation;
  admit(
    intent: CoordinationIntent,
    options?: { readonly beforeRef?: SnapshotRef; readonly principal?: ActorRef },
  ): AdmissionResult;
  commit(ticket: AdmissionTicket): CommitResult | RuntimeViolation;
  proposeAndCommit(
    intent: CoordinationIntent,
    options?: { readonly beforeRef?: SnapshotRef; readonly principal?: ActorRef },
  ): CommitResult | RuntimeViolation | AdmissionResult;
  replay(options: ReplayOptions): ReplayResult;
  replayResolved(options: ReplayOptions): Promise<ReplayResult>;
  admitComposition(
    composition: CompositionIntent,
    options?: { readonly beforeRef?: SnapshotRef; readonly principal?: ActorRef },
  ): AdmissionResult;
  cancelAdmission(ticket: AdmissionTicket): void;
}

export function createCoordinationRuntime(deps: RuntimeDependencies): CoordinationRuntime {
  const policy = deps.policy ?? denyByDefaultPolicyEvaluator();
  const registry = deps.registry ?? new AdmissionRegistry(deps.locks);
  const admission = createAdmissionGateway({
    store: deps.durable,
    schemaContext: deps.schemaContext,
    policy,
    locks: deps.locks,
    registry,
    ...(deps.nextAdmittedId !== undefined ? { nextAdmittedId: deps.nextAdmittedId } : {}),
    ...(deps.lockLeaseMs !== undefined ? { lockLeaseMs: deps.lockLeaseMs } : {}),
  });

  const committer = createCommitter({
    durable: deps.durable,
    registry,
    clock: deps.clock,
    idGen: deps.idGen,
    handlers: deps.handlers,
    locks: deps.locks,
    ...(deps.runHistory !== undefined ? { runHistory: deps.runHistory } : {}),
    ...(deps.contentRefAuthority !== undefined
      ? { contentRefAuthority: deps.contentRefAuthority }
      : {}),
  });

  const replayVerifier = createReplayVerifier({
    durable: deps.durable,
    handlers: deps.handlers,
    schemaContext: deps.schemaContext,
    ...(deps.schemaResolver !== undefined ? { schemaResolver: deps.schemaResolver } : {}),
    ...(deps.activationDomainId !== undefined
      ? { activationDomainId: deps.activationDomainId }
      : {}),
  });

  return {
    getHead() {
      const headRef = deps.durable.head();
      if (headRef === undefined) {
        return undefined;
      }
      return deps.durable.get(headRef);
    },

    getRunHistory() {
      return deps.runHistory?.current();
    },

    changes(since) {
      return since === undefined ? deps.durable.changes() : deps.durable.since(since);
    },

    observe(input, options) {
      const principal = options?.principal;
      if (principal === undefined) {
        return runtimeViolation("observe_invalid", "principal required for observation ingest");
      }
      const result = ingestObservation(
        deps.durable,
        deps.idGen,
        deps.clock,
        input,
        principal,
        deps.contentRefAuthority,
      );
      if ("snapshot" in result && deps.runHistory !== undefined) {
        deps.runHistory.recordObservation(result.entry);
      }
      return result;
    },

    admit(intent, options) {
      return admission.admit({
        intent,
        principal: options?.principal ?? intent.initiator,
        ...(options?.beforeRef !== undefined ? { beforeRef: options.beforeRef } : {}),
      });
    },

    commit(ticket) {
      return committer.commit({ ticket });
    },

    proposeAndCommit(intent, options) {
      const admitted = admission.admit({
        intent,
        principal: options?.principal ?? intent.initiator,
        ...(options?.beforeRef !== undefined ? { beforeRef: options.beforeRef } : {}),
      });
      if (!admitted.ok) {
        return admitted;
      }
      return committer.commit({ ticket: admitted.ticket });
    },

    replay(options) {
      return replayVerifier.verify(options);
    },

    replayResolved(options) {
      return replayVerifier.verifyResolved(options);
    },

    admitComposition(composition, options) {
      return admission.admit({
        intent: coordinationIntentFromComposition(composition),
        principal: options?.principal ?? composition.initiator,
        ...(options?.beforeRef !== undefined ? { beforeRef: options.beforeRef } : {}),
      });
    },

    cancelAdmission(ticket) {
      admission.cancel(ticket);
    },
  };
}
