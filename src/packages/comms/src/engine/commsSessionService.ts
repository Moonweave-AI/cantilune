import { type Result, err, ok, type SessionId } from "@cantilune/core";
import { type CommsViolation, commsViolation } from "../foundation/commsViolation.js";
import { type CommsStore } from "../ports/commsStore.js";
import { type SessionAuthority } from "../ports/runtimePorts.js";
import {
  type SessionHandshake,
  type SessionTransportBinding,
} from "../session/sessionTransportBinding.js";
import { type AuthenticatedCommsContext } from "../peer/authenticatedPeerContext.js";
import { type EStopGate } from "../security/identityVerifier.js";
import { channelGeneration } from "../foundation/messageId.js";

export interface CommsSessionServiceDeps {
  readonly store: CommsStore;
  readonly sessionAuthority: SessionAuthority;
  readonly eStop: EStopGate;
  readonly clock: { now(): string };
}

export class CommsSessionService {
  constructor(private readonly deps: CommsSessionServiceDeps) {}

  requestSession(
    context: AuthenticatedCommsContext,
    handshake: SessionHandshake,
  ): Result<void, CommsViolation> {
    if (this.deps.eStop.isFrozen()) {
      return err(commsViolation("comms_frozen", "session", "comms E-Stop active"));
    }
    if (!this.deps.sessionAuthority.isController(handshake.sessionId, context.peer.principal)) {
      return err(
        commsViolation("session_not_authorized", "session", "caller not session controller"),
      );
    }
    this.deps.store.putHandshake(handshake);
    return ok(undefined);
  }

  acceptSession(binding: SessionTransportBinding): Result<SessionTransportBinding, CommsViolation> {
    if (this.deps.store.getSessionBinding(binding.sessionId) !== undefined) {
      return err(
        commsViolation("session_not_authorized", "session", "session binding already exists"),
      );
    }
    this.deps.store.casSessionBinding({
      sessionId: binding.sessionId,
      expectedGeneration: channelGeneration(0),
      next: binding,
    });
    return ok(binding);
  }

  getBinding(sessionId: SessionId): SessionTransportBinding | undefined {
    return this.deps.store.getSessionBinding(sessionId);
  }
}
