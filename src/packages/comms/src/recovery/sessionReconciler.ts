import { type Result, err, ok } from "@cantilune/core";
import { type CommsViolation, commsViolation } from "../foundation/commsViolation.js";
import { type CommsStore } from "../ports/commsStore.js";
import { type SessionAuthority } from "../ports/runtimePorts.js";
import { type EStopGate } from "../security/identityVerifier.js";

export interface SessionReconcilerDeps {
  readonly store: CommsStore;
  readonly sessionAuthority: SessionAuthority;
  readonly eStop: EStopGate;
}

export interface SessionReconcileReport {
  readonly active: number;
  readonly orphaned: readonly string[];
  readonly stale: readonly string[];
}

/** Validates session transport bindings against runtime session authority. */
export class SessionReconciler {
  constructor(private readonly deps: SessionReconcilerDeps) {}

  reconcile(): Result<SessionReconcileReport, CommsViolation> {
    if (this.deps.eStop.isFrozen()) {
      return err(commsViolation("comms_frozen", "session", "comms E-Stop active"));
    }

    const snapshot = this.deps.store.snapshot();
    const orphaned: string[] = [];
    const stale: string[] = [];
    let active = 0;

    for (const [sessionKey, binding] of snapshot.sessions) {
      const sessionId = binding.sessionId;
      const controllerKnown = this.deps.sessionAuthority.isController(
        sessionId,
        binding.localRuntimeInstanceId as never,
      );
      if (!controllerKnown && binding.status === "active") {
        orphaned.push(sessionKey);
        continue;
      }
      if (binding.status === "draining" || binding.status === "closed") {
        stale.push(sessionKey);
        continue;
      }
      active += 1;
    }

    return ok({ active, orphaned, stale });
  }
}
