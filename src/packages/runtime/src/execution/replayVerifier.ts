import { validateSnapshotIntegrity } from "@cantilune/core";
import type {
  ActivationDomainId,
  ChangeId,
  CollaborationSnapshot,
  CoordinationChange,
  CoreViolation,
  SnapshotRef,
} from "@cantilune/core";
import { snapshotsCanonicallyEqual } from "../codec/canonicalSnapshot.js";
import { runtimeViolation } from "../foundation/errors.js";
import type { RuntimeViolation } from "../foundation/errors.js";
import {
  createActiveSchemaContext,
  snapshotSchemaEpochBinding,
  type ActiveSchemaContext,
} from "../engine/activeSchemaContext.js";
import type { MutableSchemaContextHolder } from "../engine/memoryEpochAdministration.js";
import { resolveActiveSchemaContext } from "../engine/schemaContextProvider.js";
import type { DurableCoordinator } from "../ports/durableCoordinator.js";
import type { RuntimeSchemaResolver } from "../ports/runtimeSchemaResolver.js";
import { schemaContentDigest } from "../schema/schemaContentDigest.js";
import { snapshotOrchestrationSchema } from "../schema/orchestrationSchema.js";
import { applyRecipe } from "./applyChange.js";
import { changeContinuesChain, isVerifiableUnloggedAdvance } from "../codec/observationBridge.js";
import type { OperationHandlerRegistry } from "./handlerRegistry.js";

export interface ReplayOptions {
  readonly fromRef: SnapshotRef;
  readonly toRef?: SnapshotRef;
  readonly changes?: readonly CoordinationChange[];
}

export interface ReplayStep {
  readonly changeId: ChangeId;
  readonly beforeRef: SnapshotRef;
  readonly afterRef: SnapshotRef;
}

export interface ReplayVerification {
  readonly ok: true;
  readonly terminalRef: SnapshotRef;
  readonly terminal: CollaborationSnapshot;
  readonly steps: readonly ReplayStep[];
}

export type ReplayResult =
  ReplayVerification | { readonly ok: false; readonly violation: RuntimeViolation };

export interface ReplayVerifierDeps {
  readonly durable: DurableCoordinator;
  readonly handlers: OperationHandlerRegistry;
  readonly schemaContext: ActiveSchemaContext | MutableSchemaContextHolder;
  readonly schemaResolver?: RuntimeSchemaResolver;
  readonly activationDomainId?: ActivationDomainId;
}

type StepOutcome =
  | { readonly ok: true; readonly next: CollaborationSnapshot }
  | { readonly ok: false; readonly violation: RuntimeViolation };

/**
 * Recomputes one change from its recipe and checks the result against whatever
 * the store already holds for that afterRef.
 */
function replayOneChange(
  deps: ReplayVerifierDeps,
  state: CollaborationSnapshot,
  change: CoordinationChange,
  schemaContext: ActiveSchemaContext,
): StepOutcome {
  if (state.snapshotRef !== change.beforeRef) {
    return {
      ok: false,
      violation: runtimeViolation(
        "replay_mismatch",
        `state ref ${state.snapshotRef} !== change.beforeRef ${change.beforeRef}`,
        { path: "beforeRef" },
      ),
    };
  }

  const recipe = deps.durable.recipeForChange(change);
  if (recipe === undefined) {
    return {
      ok: false,
      violation: runtimeViolation("replay_mismatch", `missing recipe for ${change.changeId}`),
    };
  }

  if (recipe.epochId !== change.epochId || state.epochId !== change.epochId) {
    return {
      ok: false,
      violation: runtimeViolation("replay_mismatch", "change, recipe, and source epoch disagree", {
        expected: change.epochId,
        actual: `${String(recipe.epochId)}/${String(state.epochId)}`,
        path: "epochId",
      }),
    };
  }
  if (schemaContext.epochId !== change.epochId) {
    return {
      ok: false,
      violation: runtimeViolation(
        "replay_mismatch",
        "active schema context does not match the historical change epoch",
        {
          expected: change.epochId,
          actual: schemaContext.epochId,
          path: "schemaContext.epochId",
        },
      ),
    };
  }
  const revision = recipe.templateRef?.revision ?? change.templateRef?.revision;
  const template = schemaContext.getTemplate(change.operationTypeId, revision);
  if (template === undefined) {
    return {
      ok: false,
      violation: runtimeViolation(
        "template_not_found",
        `no template for ${change.operationTypeId}@${revision ?? "default"}`,
        { operationTypeId: change.operationTypeId },
      ),
    };
  }

  const result = applyRecipe(state, recipe, deps.handlers, { template });
  if (!result.ok) {
    return {
      ok: false,
      violation: runtimeViolation("replay_mismatch", result.reason, {
        operationTypeId: change.operationTypeId,
      }),
    };
  }

  try {
    validateSnapshotIntegrity(result.after);
  } catch (error) {
    return {
      ok: false,
      violation: runtimeViolation("replay_mismatch", "recomputed snapshot invalid", {
        ...causeDetail(error),
      }),
    };
  }

  const stored = deps.durable.get(change.afterRef);
  if (stored !== undefined && !snapshotsCanonicallyEqual(result.after, stored)) {
    return {
      ok: false,
      violation: runtimeViolation(
        "replay_mismatch",
        `recomputed snapshot differs from store at ${change.afterRef}`,
      ),
    };
  }

  return { ok: true, next: stored ?? result.after };
}

/**
 * Advances the running state across observations that landed between two
 * commits, so the next change is recomputed from the state it was admitted
 * against.
 *
 * The stored snapshot is not trusted on sight: it is accepted only after the
 * observation-only hop is reproduced from the current state. Observations are
 * not in the change log, so this is the one place where replay needs a stored
 * snapshot rather than T0 plus the log.
 */
function bridgeUnloggedAdvance(
  deps: ReplayVerifierDeps,
  state: CollaborationSnapshot,
  change: CoordinationChange,
): StepOutcome {
  if (state.snapshotRef === change.beforeRef) {
    return { ok: true, next: state };
  }

  const stored = deps.durable.get(change.beforeRef);
  if (stored !== undefined && isVerifiableUnloggedAdvance(state, stored)) {
    return { ok: true, next: stored };
  }

  return {
    ok: false,
    violation: runtimeViolation(
      "replay_mismatch",
      `state ref ${state.snapshotRef} !== change.beforeRef ${change.beforeRef}`,
      { path: "beforeRef" },
    ),
  };
}

/**
 * Chain-level invariants that must hold before any change is recomputed.
 *
 * Consecutive changes need not be directly contiguous: an observation between
 * two commits advances the head without writing a change, so the hop is
 * accepted only when it can be reproduced as observations alone.
 */
function validateChangeChain(
  deps: ReplayVerifierDeps,
  changes: readonly CoordinationChange[],
): RuntimeViolation | undefined {
  for (let index = 1; index < changes.length; index++) {
    const previous = changes[index - 1];
    const current = changes[index];
    if (previous === undefined || current === undefined) continue;
    if (!changeContinuesChain(previous, current, (ref) => deps.durable.get(ref))) {
      return runtimeViolation("replay_chain_broken", "invalid change chain", {
        expected: previous.afterRef,
        actual: current.beforeRef,
        path: `changes[${String(index)}].beforeRef`,
      });
    }
  }
  return undefined;
}

type SchemaContextResolution =
  | { readonly ok: true; readonly context: ActiveSchemaContext }
  | { readonly ok: false; readonly violation: RuntimeViolation };

async function resolveHistoricalSchemaContext(
  deps: ReplayVerifierDeps,
  change: CoordinationChange,
  invocationCache: Map<string, ActiveSchemaContext>,
  verifierCache: Map<string, Promise<SchemaContextResolution>>,
): Promise<SchemaContextResolution> {
  const resolver = deps.schemaResolver;
  const domainId = deps.activationDomainId;
  if (resolver === undefined || domainId === undefined) {
    return {
      ok: false,
      violation: runtimeViolation(
        "replay_mismatch",
        "historical replay requires both schemaResolver and activationDomainId",
      ),
    };
  }

  const epochKey = String(change.epochId);
  const cached = invocationCache.get(epochKey);
  if (cached !== undefined) {
    return { ok: true, context: cached };
  }

  try {
    const binding = await resolver.resolveByEpoch(domainId, change.epochId);
    if (binding === undefined) {
      return {
        ok: false,
        violation: runtimeViolation(
          "template_not_found",
          `no schema binding for historical epoch ${String(change.epochId)}`,
        ),
      };
    }
    if (binding.activationDomainId !== domainId || binding.epochId !== change.epochId) {
      return {
        ok: false,
        violation: runtimeViolation(
          "replay_mismatch",
          "schema resolver returned a binding for the wrong domain or epoch",
          {
            expected: `${String(domainId)}@${String(change.epochId)}`,
            actual: `${String(binding.activationDomainId)}@${String(binding.epochId)}`,
            path: "schemaResolver.resolveByEpoch",
          },
        ),
      };
    }

    const bindingSnapshot = snapshotSchemaEpochBinding(binding);
    const bindingKey = JSON.stringify(bindingSnapshot);
    let pendingContext = verifierCache.get(bindingKey);
    if (pendingContext === undefined) {
      pendingContext = (async (): Promise<SchemaContextResolution> => {
        try {
          const schema = await resolver.resolveSchema(bindingSnapshot.schemaRef);
          if (schema === undefined) {
            return {
              ok: false,
              violation: runtimeViolation(
                "template_not_found",
                `schema content missing for historical epoch ${String(change.epochId)}`,
              ),
            };
          }
          // Detach once before verification and use that exact snapshot for
          // both digest proof and replay context. A resolver-owned object may
          // be mutated after resolution; two independent reads would reopen a
          // digest-to-admission TOCTOU window.
          const schemaSnapshot = snapshotOrchestrationSchema(schema);
          const actualDigest = schemaContentDigest(schemaSnapshot);
          if (
            schemaSnapshot.schemaId !== bindingSnapshot.schemaRef.schemaId ||
            actualDigest !== bindingSnapshot.schemaRef.digest
          ) {
            return {
              ok: false,
              violation: runtimeViolation(
                "replay_mismatch",
                "schema resolver returned content that does not match the bound schema ref",
                {
                  expected: `${String(bindingSnapshot.schemaRef.schemaId)}@${String(bindingSnapshot.schemaRef.digest)}`,
                  actual: `${String(schemaSnapshot.schemaId)}@${String(actualDigest)}`,
                  path: "schemaResolver.resolveSchema",
                },
              ),
            };
          }

          return {
            ok: true,
            context: createActiveSchemaContext(schemaSnapshot, change.epochId, bindingSnapshot),
          };
        } catch (error) {
          return {
            ok: false,
            violation: runtimeViolation(
              "replay_mismatch",
              `historical schema resolution failed: ${
                error instanceof Error ? error.message : String(error)
              }`,
            ),
          };
        }
      })();
      verifierCache.set(bindingKey, pendingContext);
    }

    const resolved = await pendingContext;
    if (!resolved.ok) {
      // Resolver availability and missing content may be transient. A failed
      // lookup is not an immutable epoch authority and must remain retryable.
      if (verifierCache.get(bindingKey) === pendingContext) {
        verifierCache.delete(bindingKey);
      }
      return resolved;
    }
    invocationCache.set(epochKey, resolved.context);
    return resolved;
  } catch (error) {
    return {
      ok: false,
      violation: runtimeViolation(
        "replay_mismatch",
        `historical schema resolution failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      ),
    };
  }
}

function replayInitialState(
  deps: ReplayVerifierDeps,
  options: ReplayOptions,
):
  | {
      readonly ok: true;
      readonly state: CollaborationSnapshot;
      readonly changes: readonly CoordinationChange[];
    }
  | { readonly ok: false; readonly result: ReplayResult } {
  const state = deps.durable.get(options.fromRef);
  if (state === undefined) {
    return {
      ok: false,
      result: {
        ok: false,
        violation: runtimeViolation("replay_chain_broken", `missing snapshot ${options.fromRef}`),
      },
    };
  }
  return {
    ok: true,
    state,
    changes: options.changes ?? deps.durable.since(options.fromRef),
  };
}

function replayTerminalResult(
  state: CollaborationSnapshot,
  steps: readonly ReplayStep[],
  toRef: SnapshotRef | undefined,
): ReplayResult {
  if (toRef !== undefined && state.snapshotRef !== toRef) {
    return {
      ok: false,
      violation: runtimeViolation(
        "replay_mismatch",
        `terminal ${state.snapshotRef} !== expected ${toRef}`,
      ),
    };
  }
  return { ok: true, terminalRef: state.snapshotRef, terminal: state, steps };
}

export function createReplayVerifier(deps: ReplayVerifierDeps) {
  // Successful resolutions are immutable authority for the lifetime of this
  // verifier. The key is the complete detached binding identity, so a reused
  // epoch id with a different schema/policy/manifest binding cannot alias it.
  // Promise caching also makes concurrent verifications converge on one
  // detached schema snapshot.
  const historicalContexts = new Map<string, Promise<SchemaContextResolution>>();
  const verify = (options: ReplayOptions): ReplayResult => {
    let state = deps.durable.get(options.fromRef);
    if (state === undefined) {
      return {
        ok: false,
        violation: runtimeViolation("replay_chain_broken", `missing snapshot ${options.fromRef}`),
      };
    }

    const changes = options.changes ?? deps.durable.since(options.fromRef);

    if (changes.length === 0) {
      return replayTerminalResult(state, [], options.toRef);
    }

    const chainViolation = validateChangeChain(deps, changes);
    if (chainViolation !== undefined) {
      return { ok: false, violation: chainViolation };
    }

    const steps: ReplayStep[] = [];

    for (const change of changes) {
      const bridged = bridgeUnloggedAdvance(deps, state, change);
      if (!bridged.ok) {
        return { ok: false, violation: bridged.violation };
      }
      state = bridged.next;

      const outcome = replayOneChange(
        deps,
        state,
        change,
        resolveActiveSchemaContext({ schemaContext: deps.schemaContext }),
      );
      if (!outcome.ok) {
        return { ok: false, violation: outcome.violation };
      }

      steps.push({
        changeId: change.changeId,
        beforeRef: change.beforeRef,
        afterRef: change.afterRef,
      });

      state = outcome.next;

      if (options.toRef !== undefined && change.afterRef === options.toRef) {
        break;
      }
    }

    const terminalRef = state.snapshotRef;
    if (options.toRef !== undefined && terminalRef !== options.toRef) {
      return {
        ok: false,
        violation: runtimeViolation(
          "replay_mismatch",
          `terminal ${terminalRef} !== expected ${options.toRef}`,
        ),
      };
    }

    return { ok: true, terminalRef, terminal: state, steps };
  };

  return {
    verify,

    /**
     * Replays each change against the schema binding for that change's epoch.
     * The legacy synchronous `verify` remains available for single-epoch
     * callers; an asynchronous resolver cannot be safely hidden behind it.
     */
    async verifyResolved(options: ReplayOptions): Promise<ReplayResult> {
      if (deps.schemaResolver === undefined) {
        return verify(options);
      }
      if (deps.activationDomainId === undefined) {
        return {
          ok: false,
          violation: runtimeViolation(
            "replay_mismatch",
            "activationDomainId is required when schemaResolver is configured",
          ),
        };
      }

      const initial = replayInitialState(deps, options);
      if (!initial.ok) {
        return initial.result;
      }
      let state = initial.state;
      const changes = initial.changes;
      if (changes.length === 0) {
        return replayTerminalResult(state, [], options.toRef);
      }

      const chainViolation = validateChangeChain(deps, changes);
      if (chainViolation !== undefined) {
        return { ok: false, violation: chainViolation };
      }

      const contexts = new Map<string, ActiveSchemaContext>();
      const steps: ReplayStep[] = [];
      for (const change of changes) {
        const bridged = bridgeUnloggedAdvance(deps, state, change);
        if (!bridged.ok) {
          return { ok: false, violation: bridged.violation };
        }
        state = bridged.next;

        const resolved = await resolveHistoricalSchemaContext(
          deps,
          change,
          contexts,
          historicalContexts,
        );
        if (!resolved.ok) {
          return { ok: false, violation: resolved.violation };
        }
        const outcome = replayOneChange(deps, state, change, resolved.context);
        if (!outcome.ok) {
          return { ok: false, violation: outcome.violation };
        }

        steps.push({
          changeId: change.changeId,
          beforeRef: change.beforeRef,
          afterRef: change.afterRef,
        });
        state = outcome.next;

        if (options.toRef !== undefined && change.afterRef === options.toRef) {
          break;
        }
      }

      return replayTerminalResult(state, steps, options.toRef);
    },
  };
}

function extractCoreViolation(error: unknown): CoreViolation | undefined {
  if (error !== null && typeof error === "object" && "violation" in error) {
    const violation = (error as { violation?: CoreViolation }).violation;
    return violation;
  }
  return undefined;
}

/** Spreadable `cause` detail, empty when the error carries no core violation. */
function causeDetail(error: unknown): { cause?: CoreViolation } {
  const cause = extractCoreViolation(error);
  return cause !== undefined ? { cause } : {};
}

export type ReplayVerifier = ReturnType<typeof createReplayVerifier>;
