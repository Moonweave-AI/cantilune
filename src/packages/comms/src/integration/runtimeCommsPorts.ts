import { err, ok, schemaAdmissionId } from "@cantilune/core";
import {
  type CoordinationRuntime,
  type RuntimeEpochAdministration,
  type RuntimeViolation,
} from "@cantilune/runtime";
import { type RuntimeObservationPort, type RuntimeCommitPort } from "../ports/runtimePorts.js";
import { type CommsViolation, commsViolation } from "../foundation/commsViolation.js";

export interface RuntimeCommsPortsInput {
  readonly runtime: CoordinationRuntime;
  readonly epochAdmin?: RuntimeEpochAdministration;
}

export interface RuntimeCommsPorts {
  readonly observation: RuntimeObservationPort;
  readonly runtimeCommit: RuntimeCommitPort;
}

function isRuntimeViolation(value: unknown): value is RuntimeViolation {
  return (
    typeof value === "object" &&
    value !== null &&
    "code" in value &&
    "message" in value &&
    !("snapshot" in value)
  );
}

function mapRuntimeViolationCode(violation: RuntimeViolation): CommsViolation["code"] {
  if (violation.code === "observe_invalid") {
    return "invalid_input";
  }
  if (violation.code === "resource_conflict" || violation.code === "replay_mismatch") {
    return "stale_binding";
  }
  return "runtime_commit_failed";
}

function mapRuntimeViolation(
  violation: RuntimeViolation,
  phase: CommsViolation["phase"],
): CommsViolation {
  const code = mapRuntimeViolationCode(violation);
  return commsViolation(code, phase, violation.message, { retryable: code === "stale_binding" });
}

/** Maps @cantilune/runtime observe/commit to comms runtime ports. */
export function createRuntimeCommsPorts(input: RuntimeCommsPortsInput): RuntimeCommsPorts {
  const { runtime, epochAdmin } = input;

  const observation: RuntimeObservationPort = {
    async observe(observeInput) {
      const result = runtime.observe(
        {
          source: observeInput.source,
          payloadRef: observeInput.payloadRef,
        },
        { principal: observeInput.principal },
      );
      if (isRuntimeViolation(result)) {
        return err(mapRuntimeViolation(result, "receive"));
      }
      return ok({ snapshotRef: result.snapshot.snapshotRef });
    },
  };

  const runtimeCommit: RuntimeCommitPort = {
    async commitMessage(commitInput) {
      const head = runtime.getHead();
      if (head === undefined) {
        return err(commsViolation("runtime_commit_failed", "send", "runtime head missing"));
      }
      if (head.snapshotRef !== commitInput.snapshotRef) {
        return err(
          commsViolation(
            "runtime_commit_failed",
            "send",
            "observation snapshot is not runtime head",
            {
              retryable: true,
            },
          ),
        );
      }
      const tail = head.auditTail.at(-1);
      if (tail === undefined) {
        return err(
          commsViolation("runtime_commit_failed", "send", "audit tail empty after observe"),
        );
      }
      const receiptRef = `comms-msg://${commitInput.snapshotRef}#${commitInput.messageId}#${commitInput.envelopeDigest}`;
      return ok({ receiptRef });
    },

    async commitReconnect(reconnectInput) {
      if (epochAdmin === undefined) {
        return err(
          commsViolation(
            "runtime_commit_failed",
            "reconnect",
            "runtime epoch administration not configured",
          ),
        );
      }
      const admissionId = schemaAdmissionId(reconnectInput.admissionId);
      const recovered = await epochAdmin.recoverEpochTransition(admissionId);
      if (recovered.ok) {
        const receiptRef = String(recovered.value.afterSnapshotRef);
        return ok({ receiptRef });
      }
      return err(mapRuntimeViolation(recovered.error, "reconnect"));
    },
  };

  return { observation, runtimeCommit };
}
