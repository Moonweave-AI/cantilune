import { type Result, err, ok, type SchemaEpochBinding } from "@cantilune/core";
import { commsViolation, type CommsViolation } from "../foundation/commsViolation.js";
import { type CommunicationEnvelope } from "../envelope/communicationEnvelope.js";
import { type AuthenticatedCommsContext } from "../peer/authenticatedPeerContext.js";
import { type CommsStore } from "../ports/commsStore.js";
import { assertAuthenticatedCommsContext } from "./commsCapability.js";
import { verifyEnvelopeIntegrityDigest } from "../codec/strictWireCodec.js";
import { type SessionAuthority } from "../ports/runtimePorts.js";

type OutboundEnvelopeInput = {
  readonly context: AuthenticatedCommsContext;
  readonly envelope: CommunicationEnvelope;
  readonly sessionAuthority: SessionAuthority;
  readonly bindingResolver: { getActiveBinding(domainId: string): SchemaEpochBinding | undefined };
  readonly store: CommsStore;
  readonly clock: { now(): string };
};

function validateOutboundSender(input: OutboundEnvelopeInput): Result<void, CommsViolation> {
  if (
    input.envelope.sender.actorId !== input.context.peer.principal.actorId ||
    input.envelope.sender.kind !== input.context.peer.principal.kind
  ) {
    return err(
      commsViolation(
        "identity_unverified",
        "send",
        "envelope sender must match authenticated principal",
      ),
    );
  }
  return ok(undefined);
}

function validateOutboundSessionMembership(
  input: OutboundEnvelopeInput,
): Result<void, CommsViolation> {
  if (
    !input.sessionAuthority.isMember(input.envelope.metadata.sessionId, input.envelope.recipient)
  ) {
    return err(
      commsViolation("session_not_authorized", "send", "recipient is not a session participant"),
    );
  }
  if (
    !input.sessionAuthority.isMember(
      input.envelope.metadata.sessionId,
      input.context.peer.principal,
    )
  ) {
    return err(commsViolation("session_not_authorized", "send", "sender not session member"));
  }
  return ok(undefined);
}

function validateOutboundBinding(input: OutboundEnvelopeInput): Result<void, CommsViolation> {
  const binding = input.bindingResolver.getActiveBinding("default");
  if (binding !== undefined) {
    if (binding.epochId !== input.envelope.metadata.epochId) {
      return err(commsViolation("stale_binding", "send", "envelope epochId stale"));
    }
    if (binding.epochOrdinal !== input.envelope.metadata.epochOrdinal) {
      return err(commsViolation("stale_binding", "send", "envelope epochOrdinal stale"));
    }
  }

  const sessionBinding = input.store.getSessionBinding(input.envelope.metadata.sessionId);
  if (sessionBinding !== undefined) {
    if (sessionBinding.channelId !== input.envelope.channelId) {
      return err(commsViolation("session_not_authorized", "send", "channelId mismatch"));
    }
    if (sessionBinding.channelGeneration !== input.envelope.channelGeneration) {
      return err(commsViolation("stale_binding", "send", "channel generation stale"));
    }
  }
  return ok(undefined);
}

function validateOutboundEnvelopeTtl(input: OutboundEnvelopeInput): Result<void, CommsViolation> {
  const now = Date.parse(input.clock.now());
  const issued = Date.parse(input.envelope.issuedAt);
  const expires = Date.parse(input.envelope.expiresAt);
  if (Number.isNaN(issued) || Number.isNaN(expires) || expires <= issued) {
    return err(commsViolation("wire_expired", "send", "invalid envelope TTL window"));
  }
  if (!Number.isNaN(now) && now >= expires) {
    return err(commsViolation("wire_expired", "send", "envelope expired"));
  }
  return ok(undefined);
}

export function validateOutboundEnvelope(
  input: OutboundEnvelopeInput,
): Result<void, CommsViolation> {
  const sealed = assertAuthenticatedCommsContext(input.context);
  if (!sealed.ok) {
    return sealed;
  }

  const sender = validateOutboundSender(input);
  if (!sender.ok) {
    return sender;
  }

  const session = validateOutboundSessionMembership(input);
  if (!session.ok) {
    return session;
  }

  const binding = validateOutboundBinding(input);
  if (!binding.ok) {
    return binding;
  }

  const ttl = validateOutboundEnvelopeTtl(input);
  if (!ttl.ok) {
    return ttl;
  }

  const digestOk = verifyEnvelopeIntegrityDigest(input.envelope);
  if (!digestOk.ok) {
    return digestOk;
  }

  if (input.envelope.sequence < 1) {
    return err(commsViolation("invalid_input", "send", "sequence must be positive"));
  }

  return ok(undefined);
}
