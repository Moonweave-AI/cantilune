import type { Clock } from "../ports/clock.js";
import type { DurableCoordinator } from "../ports/durableCoordinator.js";
import type { IdGenerator } from "../ports/idGenerator.js";
import type { PolicyEvaluator } from "../ports/policyEvaluator.js";
import type { ResourceLockTable } from "../ports/resourceLockTable.js";
import type { ActiveSchemaContext } from "./activeSchemaContext.js";
import type { MutableSchemaContextHolder } from "./memoryEpochAdministration.js";
import type { RuntimeSchemaResolver } from "../ports/runtimeSchemaResolver.js";
import type { RuntimeEpochAdministration } from "../ports/runtimeEpochAdministration.js";
import type { OperationHandlerRegistry } from "../execution/handlerRegistry.js";
import type { RunHistoryTracker } from "./runHistoryTracker.js";
import type { AdmissionRegistry } from "../admission/admissionRegistry.js";
import type { ActivationDomainId } from "@cantilune/core";
import type { ContentRefAuthority } from "../ports/contentRefAuthority.js";

export interface RuntimeDependencies {
  readonly durable: DurableCoordinator;
  readonly clock: Clock;
  readonly idGen: IdGenerator;
  /** Active epoch-bound schema view — required for admission/replay. */
  readonly schemaContext: ActiveSchemaContext | MutableSchemaContextHolder;
  /** Optional dynamic resolver when schemaContext is derived from control-plane binding. */
  readonly schemaResolver?: RuntimeSchemaResolver;
  readonly activationDomainId?: ActivationDomainId;
  readonly epochAdministration?: RuntimeEpochAdministration;
  /** Defaults to denyByDefaultPolicyEvaluator when omitted — use templateAwarePolicyEvaluator for M2 wiring. */
  readonly policy?: PolicyEvaluator;
  readonly handlers: OperationHandlerRegistry;
  readonly locks: ResourceLockTable;
  readonly registry?: AdmissionRegistry;
  readonly runHistory?: RunHistoryTracker;
  readonly nextAdmittedId?: () => string;
  readonly lockLeaseMs?: number;
  /**
   * Authoritative synchronous content availability at commit time.
   * `introduce_artifact` fails closed when this port is absent.
   */
  readonly contentRefAuthority?: ContentRefAuthority;
}
