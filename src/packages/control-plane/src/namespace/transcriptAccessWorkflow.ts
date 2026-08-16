import {
  ACTOR_KINDS,
  canDecideTranscriptAccess,
  capabilityId,
  decideTranscriptAccess as applyTranscriptAccessDecision,
  err,
  ok,
  scopedCapability,
  transcriptAccessRequest,
  type ActorKind,
  type ActorRef,
  type Result,
  type ScopedCapability,
  type TranscriptAccessRequest,
  type TranscriptAccessRequestId,
  type TranscriptAccessStatus,
} from "@cantilune/core";
import {
  controlPlaneViolation,
  type ControlPlaneViolation,
} from "../errors/controlPlaneViolation.js";
import type { NamespaceRegistry } from "./namespaceRegistry.js";

export interface RequestTranscriptAccessInput {
  readonly requestId: TranscriptAccessRequestId;
  readonly requester: ActorRef;
  readonly subjectActorId: TranscriptAccessRequest["subjectActorId"];
  readonly subjectNamespaceId: TranscriptAccessRequest["subjectNamespaceId"];
}

export interface DecideTranscriptAccessInput {
  readonly decidedBy: ActorRef;
  readonly status: Extract<TranscriptAccessStatus, "approved" | "denied" | "revoked">;
  readonly requestId?: TranscriptAccessRequestId;
  readonly request?: TranscriptAccessRequest;
}

/**
 * `transcript_read` description for runtime to admit/commit via `withCapability`.
 * Control-plane does not write CollaborationSnapshot.
 */
export interface TranscriptReadCapabilityDescription {
  readonly capability: ScopedCapability;
  readonly request: TranscriptAccessRequest;
}

export interface TranscriptAccessDecision {
  readonly request: TranscriptAccessRequest;
  readonly capabilityDescription?: TranscriptReadCapabilityDescription;
}

export interface TranscriptAccessWorkflow {
  requestTranscriptAccess(
    input: RequestTranscriptAccessInput,
  ): Result<TranscriptAccessRequest, ControlPlaneViolation>;
  decideTranscriptAccess(
    input: DecideTranscriptAccessInput,
  ): Result<TranscriptAccessDecision, ControlPlaneViolation>;
  getRequest(requestId: TranscriptAccessRequestId): TranscriptAccessRequest | undefined;
  listRequests(): readonly TranscriptAccessRequest[];
}

export interface TranscriptAccessWorkflowOptions {
  readonly registry?: NamespaceRegistry;
}

function isActorKind(value: string): value is ActorKind {
  return (ACTOR_KINDS as readonly string[]).includes(value);
}

function requireNonEmpty(
  value: string,
  path: string,
  phase: ControlPlaneViolation["phase"],
): Result<void, ControlPlaneViolation> {
  if (value.trim().length === 0) {
    return err(controlPlaneViolation("invalid_input", phase, `${path} is required`, { path }));
  }
  return ok(undefined);
}

function canTransitionAccess(from: TranscriptAccessStatus, to: TranscriptAccessStatus): boolean {
  if (from === to) {
    return true;
  }
  if (from === "requested") {
    return to === "approved" || to === "denied" || to === "revoked";
  }
  return from === "approved" && to === "revoked";
}

function emitTranscriptReadCapability(
  request: TranscriptAccessRequest,
): TranscriptReadCapabilityDescription {
  return {
    request,
    capability: scopedCapability(
      capabilityId(`transcript-read:${request.requestId}`),
      "transcript_read",
      request.requester.actorId,
      {
        kind: "transcript",
        actorId: request.subjectActorId,
        namespaceId: request.subjectNamespaceId,
      },
    ),
  };
}

export function requestTranscriptAccess(
  input: RequestTranscriptAccessInput,
): Result<TranscriptAccessRequest, ControlPlaneViolation> {
  const requestIdCheck = requireNonEmpty(input.requestId as string, "requestId", "validate");
  if (!requestIdCheck.ok) {
    return requestIdCheck;
  }
  const requesterCheck = requireNonEmpty(
    input.requester.actorId as string,
    "requester.actorId",
    "validate",
  );
  if (!requesterCheck.ok) {
    return requesterCheck;
  }
  if (!isActorKind(input.requester.kind)) {
    return err(
      controlPlaneViolation("invalid_input", "validate", "requester kind is not a core ActorKind", {
        path: "requester.kind",
        actual: input.requester.kind,
      }),
    );
  }
  const subjectCheck = requireNonEmpty(
    input.subjectActorId as string,
    "subjectActorId",
    "validate",
  );
  if (!subjectCheck.ok) {
    return subjectCheck;
  }
  const namespaceCheck = requireNonEmpty(
    input.subjectNamespaceId as string,
    "subjectNamespaceId",
    "validate",
  );
  if (!namespaceCheck.ok) {
    return namespaceCheck;
  }
  return ok(
    transcriptAccessRequest(
      input.requestId,
      input.requester,
      input.subjectActorId,
      input.subjectNamespaceId,
    ),
  );
}

/** Subject actor is the only principal who may approve, deny, or revoke (ADR-0022). */
export function decideTranscriptAccess(
  request: TranscriptAccessRequest,
  decidedBy: ActorRef,
  status: Extract<TranscriptAccessStatus, "approved" | "denied" | "revoked">,
): Result<TranscriptAccessDecision, ControlPlaneViolation> {
  const deciderCheck = requireNonEmpty(
    decidedBy.actorId as string,
    "decidedBy.actorId",
    "authorize",
  );
  if (!deciderCheck.ok) {
    return deciderCheck;
  }
  if (!isActorKind(decidedBy.kind)) {
    return err(
      controlPlaneViolation(
        "invalid_input",
        "authorize",
        "decidedBy kind is not a core ActorKind",
        {
          path: "decidedBy.kind",
          actual: decidedBy.kind,
        },
      ),
    );
  }
  if (!canDecideTranscriptAccess(request, decidedBy.actorId)) {
    return err(
      controlPlaneViolation(
        "authorization_denied",
        "authorize",
        "only the subject actor may decide transcript access",
        {
          path: "decidedBy.actorId",
          expected: request.subjectActorId as string,
          actual: decidedBy.actorId as string,
        },
      ),
    );
  }
  if (!canTransitionAccess(request.status, status)) {
    return err(
      controlPlaneViolation(
        "invalid_input",
        "authorize",
        `cannot ${status} transcript access from ${request.status}`,
        { path: "status", expected: request.status, actual: status },
      ),
    );
  }
  const decided = applyTranscriptAccessDecision(request, decidedBy, status);
  if (status !== "approved") {
    return ok({ request: decided });
  }
  return ok({
    request: decided,
    capabilityDescription: emitTranscriptReadCapability(decided),
  });
}

export function createTranscriptAccessWorkflow(
  options: TranscriptAccessWorkflowOptions = {},
): TranscriptAccessWorkflow {
  const requests = new Map<string, TranscriptAccessRequest>();

  return {
    requestTranscriptAccess(input) {
      if (requests.has(input.requestId as string)) {
        return err(
          controlPlaneViolation(
            "idempotency_conflict",
            "validate",
            "transcript access request already exists",
            { path: "requestId", actual: input.requestId as string },
          ),
        );
      }
      if (
        options.registry !== undefined &&
        options.registry.getNamespace(input.subjectNamespaceId) === undefined
      ) {
        return err(
          controlPlaneViolation(
            "invalid_input",
            "validate",
            "subject namespace is not registered",
            { path: "subjectNamespaceId", actual: input.subjectNamespaceId as string },
          ),
        );
      }
      const created = requestTranscriptAccess(input);
      if (!created.ok) {
        return created;
      }
      requests.set(created.value.requestId as string, created.value);
      return created;
    },

    decideTranscriptAccess(input) {
      const current =
        input.request ??
        (input.requestId !== undefined ? requests.get(input.requestId as string) : undefined);
      if (current === undefined) {
        return err(
          controlPlaneViolation(
            "invalid_input",
            "authorize",
            "transcript access request not found",
            {
              path: "requestId",
            },
          ),
        );
      }
      const decided = decideTranscriptAccess(current, input.decidedBy, input.status);
      if (decided.ok) {
        requests.set(decided.value.request.requestId as string, decided.value.request);
      }
      return decided;
    },

    getRequest(requestId) {
      return requests.get(requestId as string);
    },

    listRequests() {
      return [...requests.values()];
    },
  };
}
