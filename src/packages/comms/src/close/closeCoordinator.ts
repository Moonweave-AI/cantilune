import { type Result, err, ok, type SessionId } from "@cantilune/core";
import { type CommsViolation, commsViolation } from "../foundation/commsViolation.js";
import { type CommsStore } from "../ports/commsStore.js";
import { type QuiescenceProbe, type EventSink } from "../ports/runtimePorts.js";
import { type QuiescentClosePlan, type QuiescentCloseReceipt } from "./quiescentClosePlan.js";
import { type EStopGate } from "../security/identityVerifier.js";
import { closeRecordId, commsEventId, type CommsStoreSequence } from "../foundation/messageId.js";

export interface CloseCoordinatorDeps {
  readonly store: CommsStore;
  readonly quiescence: QuiescenceProbe;
  readonly eStop: EStopGate;
  readonly events: EventSink;
  readonly clock: { now(): string };
  readonly breakGlassAuthority?: { canForceClose(operatorRef: string): boolean };
}

export class CloseCoordinator {
  constructor(private readonly deps: CloseCoordinatorDeps) {}

  async propose(plan: QuiescentClosePlan): Promise<Result<QuiescentClosePlan, CommsViolation>> {
    if (this.deps.eStop.isFrozen()) {
      return err(commsViolation("comms_frozen", "close", "comms E-Stop active"));
    }
    const now = Date.parse(this.deps.clock.now());
    const expires = Date.parse(plan.expiresAt);
    if (!Number.isNaN(now) && !Number.isNaN(expires) && now >= expires) {
      return err(commsViolation("wire_expired", "close", "close plan expired"));
    }
    this.deps.store.putClosePlan(plan);
    return ok(plan);
  }

  async complete(plan: QuiescentClosePlan): Promise<Result<QuiescentCloseReceipt, CommsViolation>> {
    const now = Date.parse(this.deps.clock.now());
    const expires = Date.parse(plan.expiresAt);
    if (!Number.isNaN(now) && !Number.isNaN(expires) && now >= expires) {
      return err(commsViolation("wire_expired", "close", "close plan expired"));
    }
    if (!plan.sendBarrierApplied) {
      return err(commsViolation("quiescence_blocked", "close", "send barrier not applied"));
    }
    if (plan.pendingOutbox > 0 || plan.pendingInbox > 0 || plan.pendingInflight > 0) {
      return err(commsViolation("quiescence_blocked", "close", "pending deliveries remain"));
    }
    if (plan.peerShutdownAckRef === undefined || plan.peerShutdownAckRef.length === 0) {
      return err(commsViolation("quiescence_blocked", "close", "peer shutdown ack missing"));
    }
    if (plan.authorizationRef.length === 0) {
      return err(
        commsViolation("session_not_authorized", "close", "authorization evidence missing"),
      );
    }

    const resourcesClear = await this.deps.quiescence.resourcesClear();
    const sessionsQuiescent = await this.deps.quiescence.sessionsQuiescent();
    if (!resourcesClear || !sessionsQuiescent) {
      this.deps.events.emit({
        eventId: commsEventId(`evt-quies-block-${plan.planId as string}`),
        storeSequence: this.deps.store.nextSequence(),
        kind: "QuiescenceBlocked",
        occurredAt: this.deps.clock.now(),
        payload: { sessionId: plan.sessionId as string },
      });
      return err(commsViolation("quiescence_blocked", "close", "runtime not quiescent"));
    }
    const receipt: QuiescentCloseReceipt = {
      planId: plan.planId,
      tombstoneRef: `tombstone://${plan.sessionId as string}`,
      storeSequence: this.deps.store.nextSequence(),
      closedAt: this.deps.clock.now(),
    };
    const event = {
      eventId: commsEventId(`evt-close-${plan.planId as string}`),
      storeSequence: receipt.storeSequence,
      kind: "SessionClosed" as const,
      occurredAt: receipt.closedAt,
      payload: { sessionId: plan.sessionId as string },
    };
    this.deps.store.finalizeClose({ plan, receipt, event });
    this.deps.events.emit(event);
    return ok(receipt);
  }

  forceClose(input: {
    readonly sessionId: SessionId;
    readonly operatorRef: string;
    readonly reason: string;
  }): Result<{ readonly planId: string }, CommsViolation> {
    if (this.deps.eStop.isFrozen()) {
      return err(commsViolation("comms_frozen", "close", "comms E-Stop active"));
    }
    if (!this.deps.breakGlassAuthority?.canForceClose(input.operatorRef)) {
      return err(commsViolation("session_not_authorized", "close", "break-glass authority denied"));
    }
    const planId = closeRecordId(`force-${input.sessionId as string}`);
    this.deps.store.putForceClose({
      planId,
      sessionId: input.sessionId,
      operatorRef: input.operatorRef,
      reason: input.reason,
      forcedAt: this.deps.clock.now(),
    });
    this.deps.events.emit({
      eventId: commsEventId(`evt-force-close-${planId as string}`),
      storeSequence: this.deps.store.nextSequence(),
      kind: "SessionClosed",
      occurredAt: this.deps.clock.now(),
      payload: { sessionId: input.sessionId as string, forced: true, reason: input.reason },
    });
    return ok({ planId: planId as string });
  }
}

export class CommsAdministrationService {
  constructor(private readonly eStop: EStopGate) {}

  setFrozen(frozen: boolean): void {
    this.eStop.setFrozen(frozen);
  }

  isFrozen(): boolean {
    return this.eStop.isFrozen();
  }
}

export class CommsQueryService {
  constructor(private readonly store: CommsStore) {}

  listEvents(since?: CommsStoreSequence) {
    return this.store.readEvents(since);
  }
}
