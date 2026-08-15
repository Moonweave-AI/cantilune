import { type Result, err, ok } from "@cantilune/core";
import { type CommsViolation, commsViolation } from "../foundation/commsViolation.js";
import { type CommsStore } from "../ports/commsStore.js";
import type { ReconnectCoordinator } from "../reconnect/reconnectCoordinator.js";
import { type AdmissionReconnectReceipt } from "../reconnect/admissionReconnectPlan.js";
import { type ReconnectRecordId, commsEventId } from "../foundation/messageId.js";
import { type EStopGate } from "../security/identityVerifier.js";
import { type Clock, type EventSink } from "../ports/runtimePorts.js";

export interface ReconnectRecoveryDeps {
  readonly store: CommsStore;
  readonly coordinator: ReconnectCoordinator;
  readonly eStop: EStopGate;
  readonly events: EventSink;
  readonly clock: Clock;
}

export interface ReconnectRecoveryReport {
  readonly recovered: readonly string[];
  readonly stillPending: readonly string[];
  readonly failed: readonly string[];
}

/** Forward-only recovery for reconnect coordinator records stuck mid-saga. */
export class ReconnectRecovery {
  constructor(private readonly deps: ReconnectRecoveryDeps) {}

  async reconcile(): Promise<Result<ReconnectRecoveryReport, CommsViolation>> {
    if (this.deps.eStop.isFrozen()) {
      return err(commsViolation("comms_frozen", "recover", "comms E-Stop active"));
    }

    const snapshot = this.deps.store.snapshot();
    const recovered: string[] = [];
    const stillPending: string[] = [];
    const failed: string[] = [];

    for (const [planId, record] of snapshot.reconnects) {
      if (record.state === "completed" || record.state === "failed") {
        continue;
      }
      if (
        record.state === "peerAccepted" ||
        record.state === "recoveryRequired" ||
        record.state === "runtimeCommitted"
      ) {
        const result = await this.deps.coordinator.recover(planId as ReconnectRecordId);
        if (result.ok) {
          recovered.push(planId);
          this.emitRecovered(result.value);
        } else {
          failed.push(planId);
        }
        continue;
      }
      stillPending.push(planId);
    }

    return ok({ recovered, stillPending, failed });
  }

  private emitRecovered(receipt: AdmissionReconnectReceipt): void {
    this.deps.events.emit({
      eventId: commsEventId(`evt-reconnect-recovered-${receipt.planId as string}`),
      storeSequence: receipt.storeSequence,
      kind: "ReconnectRecovered",
      occurredAt: this.deps.clock.now(),
      payload: { planDigest: receipt.planDigest as string },
    });
  }
}
