import { appendObservation, validateSnapshotIntegrity, withSnapshotRef } from "@cantilune/core";
import type {
  ActorRef,
  CollaborationSnapshot,
  ContentRef,
  ObservationEntry,
  Timestamp,
} from "@cantilune/core";
import { validateObservePrincipal } from "../admission/principalValidation.js";
import { runtimeViolation } from "../foundation/errors.js";
import type { RuntimeViolation } from "../foundation/errors.js";
import type { Clock } from "../ports/clock.js";
import type { DurableCoordinator } from "../ports/durableCoordinator.js";
import type { IdGenerator } from "../ports/idGenerator.js";
import type { ContentRefAuthority } from "../ports/contentRefAuthority.js";

export interface ObserveInput {
  readonly source: ActorRef;
  readonly payloadRef: ContentRef;
  readonly receivedAt?: Timestamp;
}

export interface ObserveResult {
  readonly snapshot: CollaborationSnapshot;
  readonly entry: ObservationEntry;
}

/** Each observation allocates a new SnapshotRef and CAS-updates head — prior refs stay immutable. */
export function ingestObservation(
  durable: DurableCoordinator,
  idGen: IdGenerator,
  clock: Clock,
  input: ObserveInput,
  principal: ActorRef,
  contentRefAuthority?: ContentRefAuthority,
): ObserveResult | RuntimeViolation {
  const principalError = validateObservePrincipal(input.source, principal);
  if (principalError !== undefined) {
    return runtimeViolation("observe_invalid", principalError.kind);
  }

  let payloadAvailable: unknown;
  try {
    payloadAvailable = contentRefAuthority?.isAvailable(input.payloadRef);
  } catch {
    payloadAvailable = false;
  }
  if (payloadAvailable !== true) {
    return runtimeViolation(
      "content_ref_unavailable",
      `observation payload content is unavailable: ${String(input.payloadRef)}`,
    );
  }

  const expectedHead = durable.head();
  if (expectedHead === undefined) {
    return runtimeViolation("observe_invalid", "no head snapshot to observe against");
  }

  const current = durable.get(expectedHead);
  if (current === undefined) {
    return runtimeViolation("observe_invalid", `head snapshot missing: ${expectedHead}`);
  }

  const receivedAt = input.receivedAt ?? clock.now();
  const appended = appendObservation(current, {
    source: input.source,
    payloadRef: input.payloadRef,
    receivedAt,
  });
  const nextRef = idGen.snapshotRef();
  const next = withSnapshotRef(appended, nextRef);

  try {
    validateSnapshotIntegrity(next);
  } catch {
    return runtimeViolation("observe_invalid", "observation produced invalid snapshot");
  }

  if (!durable.compareAndSwapHead(expectedHead, next)) {
    return runtimeViolation("observe_invalid", "head changed during observation ingest");
  }

  const entry = next.auditTail.at(-1);
  if (entry === undefined) {
    return runtimeViolation("observe_invalid", "missing audit tail entry after observe");
  }

  return { snapshot: next, entry };
}
